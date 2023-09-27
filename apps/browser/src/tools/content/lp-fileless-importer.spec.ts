import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import { LpFilelessImporter } from "./abstractions/lp-fileless-importer";

describe("LpFilelessImporter", () => {
  let lpFilelessImporter: LpFilelessImporter;
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
      jest.spyOn(lpFilelessImporter, "handleFeatureFlagVerification");

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
