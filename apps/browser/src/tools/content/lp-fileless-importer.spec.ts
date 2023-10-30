import { createPortSpyMock } from "../../autofill/jest/autofill-mocks";
import { sendPortMessage } from "../../autofill/jest/testing-utils";
import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import { LpFilelessImporter } from "./abstractions/lp-fileless-importer";

describe("LpFilelessImporter", () => {
  let lpFilelessImporter: LpFilelessImporter;
  const portSpy: chrome.runtime.Port = createPortSpyMock(FilelessImportPortNames.LpImporter);
  chrome.runtime.connect = jest.fn(() => portSpy);

  beforeEach(() => {
    require("./lp-fileless-importer");
    lpFilelessImporter = (globalThis as any).lpFilelessImporter;
  });

  afterEach(() => {
    (globalThis as any).lpFilelessImporter = undefined;
    jest.clearAllMocks();
    jest.resetModules();
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

      sendPortMessage(portSpy, message);

      expect(lpFilelessImporter.handleFeatureFlagVerification).not.toHaveBeenCalled();
      expect(lpFilelessImporter.triggerCsvDownload).not.toHaveBeenCalled();
    });

    it("handles the port message that verifies the fileless import feature flag", () => {
      const message = { command: "verifyFeatureFlag", filelessImportEnabled: true };
      jest.spyOn(lpFilelessImporter, "handleFeatureFlagVerification");

      sendPortMessage(portSpy, message);

      expect(lpFilelessImporter.handleFeatureFlagVerification).toHaveBeenCalledWith(message);
    });

    it("handles the port message that triggers the LastPass csv download", () => {
      const message = { command: "triggerCsvDownload" };
      jest.spyOn(lpFilelessImporter, "triggerCsvDownload");

      sendPortMessage(portSpy, message);

      expect(lpFilelessImporter.triggerCsvDownload).toHaveBeenCalled();
    });
  });
});
