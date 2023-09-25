import { mock } from "jest-mock-extended";

import { LpFilelessImporter } from "./abstractions/lp-fileless-importer";

describe("LpFilelessImporter", () => {
  let lpFilelessImporter: LpFilelessImporter & { [key: string]: any };

  beforeEach(() => {
    require("./lp-fileless-importer");
    lpFilelessImporter = (globalThis as any).lpFilelessImporter;
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
    it("should ", () => {
      jest.spyOn(lpFilelessImporter as any, "setupMessagePort");

      lpFilelessImporter.init();

      expect(lpFilelessImporter["setupMessagePort"]).toHaveBeenCalled();
    });
  });

  describe("handleFeatureFlagVerification", () => {
    it("will disconnect the port and return early if the feature flag is not set", () => {
      const message = {
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: false,
      };

      lpFilelessImporter["handleFeatureFlagVerification"](message);

      expect(lpFilelessImporter["messagePort"].disconnect).toHaveBeenCalled();
    });

    it("will suppress the download if the feature flag is set", () => {
      const message = {
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: true,
      };
      const suppressDownload = jest
        .spyOn(lpFilelessImporter as any, "suppressDownload")
        .mockImplementationOnce(jest.fn());

      lpFilelessImporter["handleFeatureFlagVerification"](message);

      expect(suppressDownload).toHaveBeenCalled();
    });

    it("will load the importer logic", () => {
      const msg = {
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: true,
      };
      const suppressDownload = jest
        .spyOn(lpFilelessImporter as any, "suppressDownload")
        .mockImplementationOnce(jest.fn());
      const loadImporter = jest.spyOn(lpFilelessImporter as any, "loadImporter");

      lpFilelessImporter["handleFeatureFlagVerification"](msg);

      expect(suppressDownload).toHaveBeenCalled();
      expect(loadImporter).toHaveBeenCalled();
    });

    it("will create a DOMContentLoaded listener used to load the importer if the document readystate is `loading`", () => {
      Object.defineProperty(document, "readyState", {
        value: "loading",
        writable: true,
      });
      const msg = {
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: true,
      };
      const suppressDownload = jest
        .spyOn(lpFilelessImporter as any, "suppressDownload")
        .mockImplementationOnce(jest.fn());
      const loadImporter = jest.spyOn(lpFilelessImporter as any, "loadImporter");
      const addEventListener = jest.spyOn(document, "addEventListener");

      lpFilelessImporter["handleFeatureFlagVerification"](msg);

      expect(suppressDownload).toHaveBeenCalled();
      expect(loadImporter).not.toHaveBeenCalled();
      expect(addEventListener).toHaveBeenCalledWith("DOMContentLoaded", expect.any(Function));
    });
  });

  describe("suppressDownload", () => {
    it("will append a script element to the document element that facilitates suppressing the download of the csv export", () => {
      const script = document.createElement("script");
      const appendChild = jest.spyOn(document.documentElement, "appendChild");
      const createElement = jest.spyOn(document, "createElement").mockReturnValue(script as any);

      lpFilelessImporter["suppressDownload"]();

      expect(createElement).toHaveBeenCalledWith("script");
      expect(appendChild).toHaveBeenCalledWith(script);
      expect(script.textContent).toEqual(
        expect.stringContaining(`const defaultAppendChild = Element.prototype.appendChild;`)
      );
    });
  });

  describe("loadImporter", () => {
    it("will set up the mutation observer and obser the document body", () => {
      const observe = jest.spyOn(MutationObserver.prototype, "observe");

      lpFilelessImporter["loadImporter"]();

      expect(lpFilelessImporter["mutationObserver"]).toBeDefined();
      expect(observe).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
      });
    });
  });

  describe("handleMutation", () => {
    it("will return early if no mutations are passed", () => {
      lpFilelessImporter["mutationObserver"] = mock<MutationObserver>({ disconnect: jest.fn() });
      const disconnect = jest.spyOn(lpFilelessImporter["mutationObserver"], "disconnect");
      const displayImportNotificationSpy = jest.spyOn(
        lpFilelessImporter as any,
        "displayImportNotification"
      );

      lpFilelessImporter["handleMutation"]([]);

      expect(displayImportNotificationSpy).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
    });

    it("will return early if no added nodes are found in the mutation", () => {
      lpFilelessImporter["mutationObserver"] = mock<MutationObserver>({ disconnect: jest.fn() });
      const disconnect = jest.spyOn(lpFilelessImporter["mutationObserver"], "disconnect");
      const displayImportNotificationSpy = jest.spyOn(
        lpFilelessImporter as any,
        "displayImportNotification"
      );

      lpFilelessImporter["handleMutation"]([{ addedNodes: [] }]);

      expect(displayImportNotificationSpy).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
    });

    it("will return early if the added node does not have a tagname of `pre`", () => {
      lpFilelessImporter["mutationObserver"] = mock<MutationObserver>({ disconnect: jest.fn() });
      const disconnect = jest.spyOn(lpFilelessImporter["mutationObserver"], "disconnect");
      const displayImportNotificationSpy = jest.spyOn(
        lpFilelessImporter as any,
        "displayImportNotification"
      );

      lpFilelessImporter["handleMutation"]([{ addedNodes: [{ nodeName: "div" }] }]);

      expect(displayImportNotificationSpy).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
    });

    it("will return early if the found `pre` element does not contain any textContent", () => {
      lpFilelessImporter["mutationObserver"] = mock<MutationObserver>({ disconnect: jest.fn() });
      const disconnect = jest.spyOn(lpFilelessImporter["mutationObserver"], "disconnect");
      const displayImportNotificationSpy = jest.spyOn(
        lpFilelessImporter as any,
        "displayImportNotification"
      );

      lpFilelessImporter["handleMutation"]([{ addedNodes: [{ nodeName: "pre" }] }]);

      expect(displayImportNotificationSpy).not.toHaveBeenCalled();
      expect(disconnect).not.toHaveBeenCalled();
    });

    it("will store the export data, display the import notification, and disconnect the mutation observer when the export data is appended", () => {
      lpFilelessImporter["mutationObserver"] = mock<MutationObserver>({ disconnect: jest.fn() });
      const disconnect = jest.spyOn(lpFilelessImporter["mutationObserver"], "disconnect");
      const displayImportNotificationSpy = jest.spyOn(
        lpFilelessImporter as any,
        "displayImportNotification"
      );

      lpFilelessImporter["handleMutation"]([
        {
          addedNodes: [
            {
              nodeName: "pre",
              textContent: "test",
            },
          ],
        },
      ]);

      expect(lpFilelessImporter["exportData"]).toEqual("test");
      expect(displayImportNotificationSpy).toHaveBeenCalled();
      expect(disconnect).toHaveBeenCalled();
    });
  });

  describe("displayImportNotification", () => {
    it("will not post a message to display the notification bar if the exportData is not present", () => {
      const postPortMessage = jest.spyOn(lpFilelessImporter as any, "postPortMessage");
      lpFilelessImporter["exportData"] = undefined;

      lpFilelessImporter["displayImportNotification"]();

      expect(postPortMessage).not.toHaveBeenCalled();
    });

    it("will post a message to display the import notification", () => {
      const postPortMessage = jest.spyOn(lpFilelessImporter as any, "postPortMessage");
      lpFilelessImporter["exportData"] = "test";

      lpFilelessImporter["displayImportNotification"]();

      expect(postPortMessage).toHaveBeenCalledWith({ command: "displayLpImportNotification" });
    });
  });

  describe("postPortMessage", () => {
    it("will post a message to the background script", () => {
      const postMessage = jest.spyOn(lpFilelessImporter["messagePort"], "postMessage");

      lpFilelessImporter["postPortMessage"]({ command: "command" });

      expect(postMessage).toHaveBeenCalledWith({ command: "command" });
    });
  });

  describe("postWindowMessage", () => {
    it("will post a message to the window", () => {
      const postMessage = jest.spyOn(window, "postMessage");

      lpFilelessImporter["postWindowMessage"]({ command: "command" });

      expect(postMessage).toHaveBeenCalledWith({ command: "command" }, "https://lastpass.com");
    });
  });

  describe("setupMessagePort", () => {
    it("will set up the long lived port between the content script and background script", () => {
      lpFilelessImporter["setupMessagePort"]();

      expect(chrome.runtime.connect).toHaveBeenCalledWith({ name: "lp-fileless-importer" });
      expect(lpFilelessImporter["messagePort"].onMessage.addListener).toHaveBeenCalledWith(
        lpFilelessImporter["handlePortMessage"]
      );
    });
  });

  describe("handlePortMessage", () => {
    it("will not trigger the handler if it does not exist on the port message handlers", () => {
      const message = { command: "test" };
      const port = mock<chrome.runtime.Port>();

      lpFilelessImporter["handlePortMessage"](message, port);

      expect(lpFilelessImporter["portMessageHandlers"]["test"]).toBeUndefined();
    });

    it("will trigger the handler if it exists on the port message handlers", () => {
      const message = { command: "test" };
      const port = mock<chrome.runtime.Port>();
      lpFilelessImporter["portMessageHandlers"]["test"] = jest.fn();

      lpFilelessImporter["handlePortMessage"](message, port);

      expect(lpFilelessImporter["portMessageHandlers"]["test"]).toHaveBeenCalled();
    });
  });
});
