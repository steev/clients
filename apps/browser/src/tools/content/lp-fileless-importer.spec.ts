import { mock } from "jest-mock-extended";

import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import { LpFilelessImporter } from "./abstractions/lp-fileless-importer";

describe("LpFilelessImporter", () => {
  let lpFilelessImporter: LpFilelessImporter & { [key: string]: any };
  let portSpy: chrome.runtime.Port & { onMessage: { callListener: (message: any) => void } };

  beforeEach(() => {
    require("./lp-fileless-importer");
    lpFilelessImporter = (globalThis as any).lpFilelessImporter;
    portSpy = (lpFilelessImporter as any)["messagePort"];
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    lpFilelessImporter = undefined;
    Object.defineProperty(document, "readyState", {
      value: "complete",
      writable: true,
    });
  });

  describe("init", () => {
    it("sets up the port connection with the background script", () => {
      lpFilelessImporter.init();

      expect(chrome.runtime.connect).toHaveBeenCalledWith({
        name: FilelessImportPortNames.LpImporter,
      });
    });
  });

  describe("handleFeatureFlagVerification", () => {
    it("disconnects the message port when the fileless import feature is disabled", () => {
      jest.spyOn(portSpy, "disconnect");

      lpFilelessImporter.handleFeatureFlagVerification({ filelessImportEnabled: false });

      expect(portSpy.disconnect).toHaveBeenCalled();
    });

    it("injects a script element that suppresses the download of the LastPass export", () => {
      const script = document.createElement("script");
      jest.spyOn(document, "createElement").mockReturnValue(script);
      jest.spyOn(document.documentElement, "appendChild");

      lpFilelessImporter.handleFeatureFlagVerification({ filelessImportEnabled: true });

      expect(document.createElement).toHaveBeenCalledWith("script");
      expect(document.documentElement.appendChild).toHaveBeenCalled();
      expect(script.textContent).toContain(
        "const defaultAppendChild = Element.prototype.appendChild;"
      );
    });

    it("sets up an event listener for DOMContentLoaded that triggers the importer when the document ready state is `loading`", () => {
      Object.defineProperty(document, "readyState", {
        value: "loading",
        writable: true,
      });
      const message = {
        command: "verifyFeatureFlag",
        filelessImportEnabled: true,
      };
      jest.spyOn(document, "addEventListener");

      lpFilelessImporter.handleFeatureFlagVerification(message);

      expect(document.addEventListener).toHaveBeenCalledWith(
        "DOMContentLoaded",
        (lpFilelessImporter as any).loadImporter
      );
    });

    it("sets up a mutation observer to watch the document body for injection of the export content", () => {
      const message = {
        command: "verifyFeatureFlag",
        filelessImportEnabled: true,
      };
      jest.spyOn(document, "addEventListener");
      jest.spyOn(window, "MutationObserver").mockImplementationOnce(() => mock<MutationObserver>());

      lpFilelessImporter.handleFeatureFlagVerification(message);

      expect(window.MutationObserver).toHaveBeenCalledWith(
        (lpFilelessImporter as any).handleMutation
      );
      expect((lpFilelessImporter as any).mutationObserver.observe).toHaveBeenCalledWith(
        document.body,
        { childList: true, subtree: true }
      );
    });
  });

  describe("triggerCsvDownload", () => {
    it("posts a window message that triggers the download of the LastPass export", () => {
      jest.spyOn(globalThis, "postMessage");

      lpFilelessImporter.triggerCsvDownload();

      expect(globalThis.postMessage).toHaveBeenCalledWith(
        { command: "triggerCsvDownload" },
        "https://lastpass.com"
      );
    });
  });

  describe("handleMutation", () => {
    beforeEach(() => {
      lpFilelessImporter["mutationObserver"] = mock<MutationObserver>({ disconnect: jest.fn() });
      jest.spyOn(portSpy, "postMessage");
    });

    it("ignores mutations that contain empty records", () => {
      lpFilelessImporter["handleMutation"]([]);

      expect(portSpy.postMessage).not.toHaveBeenCalled();
    });

    it("ignores mutations that have no added nodes in the mutation", () => {
      lpFilelessImporter["handleMutation"]([{ addedNodes: [] }]);

      expect(portSpy.postMessage).not.toHaveBeenCalled();
    });

    it("ignores mutations that have no added nodes with a tagname of `pre`", () => {
      lpFilelessImporter["handleMutation"]([{ addedNodes: [{ nodeName: "div" }] }]);

      expect(portSpy.postMessage).not.toHaveBeenCalled();
    });

    it("ignores mutations where the found `pre` element does not contain any textContent", () => {
      lpFilelessImporter["handleMutation"]([{ addedNodes: [{ nodeName: "pre" }] }]);

      expect(portSpy.postMessage).not.toHaveBeenCalled();
    });

    it("ignores mutations where the found `pre` element does not contain the expected header content", () => {
      lpFilelessImporter["handleMutation"]([
        { addedNodes: [{ nodeName: "pre", textContent: "some other content" }] },
      ]);

      expect(portSpy.postMessage).not.toHaveBeenCalled();
    });

    it("will store the export data, display the import notification, and disconnect the mutation observer when the export data is appended", () => {
      const observerDisconnectSpy = jest.spyOn(
        lpFilelessImporter["mutationObserver"],
        "disconnect"
      );

      lpFilelessImporter["handleMutation"]([
        { addedNodes: [{ nodeName: "pre", textContent: "url,username,password" }] },
      ]);

      expect(lpFilelessImporter["exportData"]).toEqual("url,username,password");
      expect(portSpy.postMessage).toHaveBeenCalledWith({ command: "displayLpImportNotification" });
      expect(observerDisconnectSpy).toHaveBeenCalled();
    });
  });

  describe("handlePortMessage", () => {
    it("ignores messages that are not registered with the portMessageHandlers", () => {
      const message = { command: "unknownCommand" };
      jest.spyOn(lpFilelessImporter, "handleFeatureFlagVerification");
      jest.spyOn(lpFilelessImporter, "triggerCsvDownload");

      portSpy.onMessage.callListener(message);

      expect(lpFilelessImporter.handleFeatureFlagVerification).not.toHaveBeenCalled();
      expect(lpFilelessImporter.triggerCsvDownload).not.toHaveBeenCalled();
    });

    it("handles the port message that verifies the fileless import feature flag", () => {
      const message = { command: "verifyFeatureFlag", filelessImportEnabled: true };
      jest.spyOn(lpFilelessImporter, "handleFeatureFlagVerification").mockImplementation();

      portSpy.onMessage.callListener(message);

      expect(lpFilelessImporter.handleFeatureFlagVerification).toHaveBeenCalledWith(message);
    });

    it("handles the port message that triggers the LastPass csv download", () => {
      const message = { command: "triggerCsvDownload" };
      jest.spyOn(lpFilelessImporter, "triggerCsvDownload");

      portSpy.onMessage.callListener(message);

      expect(lpFilelessImporter.triggerCsvDownload).toHaveBeenCalled();
    });
  });
});
