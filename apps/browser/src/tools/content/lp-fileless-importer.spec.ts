import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import { LpFilelessImporter } from "./abstractions/lp-fileless-importer";

describe("LpFilelessImporter", () => {
  let lpFilelessImporter: LpFilelessImporter;

  beforeEach(() => {
    require("./lp-fileless-importer");
    lpFilelessImporter = (globalThis as any).lpFilelessImporter;
  });

  afterEach(() => {
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
      jest.spyOn((lpFilelessImporter as any)["messagePort"], "disconnect");

      lpFilelessImporter.handleFeatureFlagVerification({ filelessImportEnabled: false });

      expect((lpFilelessImporter as any)["messagePort"].disconnect).toHaveBeenCalled();
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
    it("returns without triggering a handler if the port message is not registered with the portMessageHandlers", () => {
      jest.spyOn(lpFilelessImporter as any, "handleFeatureFlagVerification");

      (lpFilelessImporter as any)["handlePortMessage"](
        { command: "unknownCommand" },
        (lpFilelessImporter as any)["messagePort"]
      );

      expect((lpFilelessImporter as any)["handleFeatureFlagVerification"]).not.toHaveBeenCalled();
    });

    it("handles messages that are registered with the portMessageHandlers", () => {
      const handlerMethodPairs = {
        triggerCsvDownload: "triggerCsvDownload",
        verifyFeatureFlag: "handleFeatureFlagVerification",
      };

      for (const [command, handler] of Object.entries(handlerMethodPairs)) {
        jest.spyOn(lpFilelessImporter as any, handler);

        (lpFilelessImporter as any)["handlePortMessage"](
          { command },
          (lpFilelessImporter as any)["messagePort"]
        );

        expect((lpFilelessImporter as any)[handler]).toHaveBeenCalled();
      }
    });
  });
});
