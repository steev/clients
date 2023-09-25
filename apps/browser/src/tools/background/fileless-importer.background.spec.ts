import { mock } from "jest-mock-extended";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";

import FilelessImporterBackground from "./fileless-importer.background";

describe("FilelessImporterBackground", () => {
  let filelessImporterBackground: FilelessImporterBackground;
  const configService = mock<ConfigService>();
  const authService = mock<AuthService>();

  beforeEach(() => {
    filelessImporterBackground = new FilelessImporterBackground(configService, authService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("triggerLpImporterCsvDownload", () => {
    it("will post a `triggerCsvDownload` message and disconnect the port", () => {
      filelessImporterBackground["lpImporterPort"] = mock<chrome.runtime.Port>();

      filelessImporterBackground["triggerLpImporterCsvDownload"]();

      expect(filelessImporterBackground["lpImporterPort"].postMessage).toHaveBeenCalledWith({
        command: "triggerCsvDownload",
      });
      expect(filelessImporterBackground["lpImporterPort"].disconnect).toHaveBeenCalled();
    });
  });

  describe("setupExtensionMessageListeners", () => {
    it("will set up a runtime onConnect listener", () => {
      filelessImporterBackground["setupExtensionMessageListeners"]();

      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledWith(
        filelessImporterBackground["handlePortOnConnect"]
      );
    });
  });

  describe("handlePortOnConnect", () => {
    const port = mock<chrome.runtime.Port>({
      name: "lp-fileless-importer",
      onMessage: {
        addListener: jest.fn(),
      },
      onDisconnect: {
        addListener: jest.fn(),
      },
    });

    it("will disconnect the port if the user auth status is not unlocked", async () => {
      jest
        .spyOn(filelessImporterBackground["authService"], "getAuthStatus")
        .mockResolvedValue(AuthenticationStatus.Locked);
      jest
        .spyOn(filelessImporterBackground["configService"], "getFeatureFlag")
        .mockResolvedValue(true);

      await filelessImporterBackground["handlePortOnConnect"](port);

      expect(filelessImporterBackground["authService"].getAuthStatus).toHaveBeenCalled();
      expect(filelessImporterBackground["configService"].getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.BrowserFilelessImport
      );
      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: false,
      });
      expect(port.disconnect).toHaveBeenCalled();
      expect(port.onMessage.addListener).not.toHaveBeenCalled();
      expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("will disconnect the port if the feature flag is not set to true", async () => {
      jest
        .spyOn(filelessImporterBackground["authService"], "getAuthStatus")
        .mockResolvedValue(AuthenticationStatus.Unlocked);
      jest
        .spyOn(filelessImporterBackground["configService"], "getFeatureFlag")
        .mockResolvedValue(false);

      await filelessImporterBackground["handlePortOnConnect"](port);

      expect(filelessImporterBackground["authService"].getAuthStatus).toHaveBeenCalled();
      expect(filelessImporterBackground["configService"].getFeatureFlag).toHaveBeenCalledWith(
        FeatureFlag.BrowserFilelessImport
      );
      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: false,
      });
      expect(port.disconnect).toHaveBeenCalled();
      expect(port.onMessage.addListener).not.toHaveBeenCalled();
      expect(port.onDisconnect.addListener).not.toHaveBeenCalled();
    });

    it("set up the port's onMessage and onDisconnect listeners", async () => {
      jest
        .spyOn(filelessImporterBackground["authService"], "getAuthStatus")
        .mockResolvedValue(AuthenticationStatus.Unlocked);
      jest
        .spyOn(filelessImporterBackground["configService"], "getFeatureFlag")
        .mockResolvedValue(true);

      await filelessImporterBackground["handlePortOnConnect"](port);

      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportFeatureFlagEnabled: true,
      });
      expect(port.onMessage.addListener).toHaveBeenCalledWith(
        filelessImporterBackground["handleImporterPortMessage"]
      );
      expect(port.onDisconnect.addListener).toHaveBeenCalledWith(
        filelessImporterBackground["handleImporterPortDisconnect"]
      );
    });
  });

  describe("handleImporterPortMessage", () => {
    it("will return without triggering a handler if the command does not exist", () => {
      const port = mock<chrome.runtime.Port>({
        name: "lp-fileless-importer",
      });
      const message = { command: "test" };

      filelessImporterBackground["handleImporterPortMessage"](message, port);

      expect(filelessImporterBackground["lpImporterPortMessageHandlers"]["test"]).toBeUndefined();
    });

    it("will trigger a handler if the command exists", () => {
      const port = mock<chrome.runtime.Port>({
        name: "lp-fileless-importer",
      });
      const message = { command: "test" };
      filelessImporterBackground["lpImporterPortMessageHandlers"]["test"] = jest.fn();

      filelessImporterBackground["handleImporterPortMessage"](message, port);

      expect(
        filelessImporterBackground["lpImporterPortMessageHandlers"]["test"]
      ).toHaveBeenCalled();
    });
  });

  describe("handleImporterPortDisconnect", () => {
    it("will set the port reference to null", () => {
      const port = mock<chrome.runtime.Port>({
        name: "lp-fileless-importer",
      });
      filelessImporterBackground["lpImporterPort"] = port;

      filelessImporterBackground["handleImporterPortDisconnect"](port);

      expect(filelessImporterBackground["lpImporterPort"]).toBeNull();
    });
  });
});
