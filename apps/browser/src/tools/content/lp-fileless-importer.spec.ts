import { mock } from "jest-mock-extended";

describe("LpFilelessImporter", () => {
  let lpFilelessImporter: any;

  beforeEach(() => {
    require("./lp-fileless-importer");
    lpFilelessImporter = (globalThis as any).lpFilelessImporter;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
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
      const msg = {
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: false,
      };

      lpFilelessImporter["handleFeatureFlagVerification"](msg);

      expect(lpFilelessImporter["messagePort"].disconnect).toHaveBeenCalled();
    });

    it("will suppress the download if the feature flag is set", () => {
      const msg = {
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: true,
      };
      const suppressDownload = jest
        .spyOn(lpFilelessImporter as any, "suppressDownload")
        .mockImplementationOnce(jest.fn());

      lpFilelessImporter["handleFeatureFlagVerification"](msg);

      expect(suppressDownload).toHaveBeenCalled();
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
      const msg = { command: "test" };
      const port = mock<chrome.runtime.Port>();

      lpFilelessImporter["handlePortMessage"](msg, port);

      expect(lpFilelessImporter["portMessageHandlers"]["test"]).toBeUndefined();
    });

    it("will trigger the handler if it exists on the port message handlers", () => {
      const msg = { command: "test" };
      const port = mock<chrome.runtime.Port>();
      lpFilelessImporter["portMessageHandlers"]["test"] = jest.fn();

      lpFilelessImporter["handlePortMessage"](msg, port);

      expect(lpFilelessImporter["portMessageHandlers"]["test"]).toHaveBeenCalled();
    });
  });
});
