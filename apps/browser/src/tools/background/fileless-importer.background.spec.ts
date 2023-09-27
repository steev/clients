import { mock } from "jest-mock-extended";

import { PolicyService } from "@bitwarden/common/admin-console/services/policy/policy.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AuthService } from "@bitwarden/common/auth/services/auth.service";
import { ConfigService } from "@bitwarden/common/platform/services/config/config.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ImportServiceAbstraction } from "@bitwarden/importer";

import NotificationBackground from "../../autofill/background/notification.background";
import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import FilelessImporterBackground from "./fileless-importer.background";

type PortMock = chrome.runtime.Port & {
  onMessage: { callListener: (message: any) => void };
  onDisconnect: { callListener: () => void };
};
type OnConnectMock = chrome.runtime.ExtensionConnectEvent & {
  callListener: (port: PortMock) => Promise<void>;
};

function createPortMock(name: string): PortMock {
  let onMessageCallback: CallableFunction;
  let onDisconnectCallback: CallableFunction;

  const port: PortMock = mock<PortMock>({
    name,
    onMessage: {
      addListener: jest.fn((callback) => (onMessageCallback = callback)),
      callListener: async (message: any) => onMessageCallback(message, port),
    },
    onDisconnect: {
      addListener: jest.fn((callback) => (onDisconnectCallback = callback)),
      callListener: async () => onDisconnectCallback(port),
    },
  });
  return port;
}

function setupOnConnectMock() {
  let onConnectCallback: CallableFunction;

  chrome.runtime.onConnect = {
    addListener: jest.fn((callback) => (onConnectCallback = callback)),
    removeRules: jest.fn(),
    hasListener: jest.fn(),
    getRules: jest.fn(),
    addRules: jest.fn(),
    removeListener: jest.fn(),
    hasListeners: jest.fn(),
    callListener: (port: PortMock) => onConnectCallback(port),
  } as OnConnectMock;
}

describe("FilelessImporterBackground ", () => {
  let filelessImporterBackground: FilelessImporterBackground;
  const configService = mock<ConfigService>();
  const authService = mock<AuthService>();
  const policyService = mock<PolicyService>();
  const notificationBackground = mock<NotificationBackground>();
  const importService = mock<ImportServiceAbstraction>();
  const syncService = mock<SyncService>();
  let onConnectMock: OnConnectMock;

  beforeEach(() => {
    setupOnConnectMock();
    onConnectMock = chrome.runtime.onConnect as OnConnectMock;
    filelessImporterBackground = new FilelessImporterBackground(
      configService,
      authService,
      policyService,
      notificationBackground,
      importService,
      syncService
    );
    filelessImporterBackground.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("init", () => {
    it("sets up the port message listeners on initialization of the class", () => {
      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe("handle ports onConnect", () => {
    beforeEach(() => {
      jest.spyOn(authService, "getAuthStatus").mockResolvedValue(AuthenticationStatus.Unlocked);
      jest.spyOn(configService, "getFeatureFlag").mockResolvedValue(true);
      jest
        .spyOn(filelessImporterBackground as any, "removeIndividualVault")
        .mockResolvedValue(false);
    });

    it("ignores the port connection if the port name is not present in the set of filelessImportNames", async () => {
      const port = createPortMock("some-other-port");

      await onConnectMock.callListener(port);

      expect(port.postMessage).not.toHaveBeenCalled();
    });

    it("posts a message to the port indicating that the fileless import feature is disabled if the user's auth status is not unlocked", async () => {
      const port = createPortMock(FilelessImportPortNames.LpImporter);
      jest.spyOn(authService, "getAuthStatus").mockResolvedValue(AuthenticationStatus.Locked);

      await onConnectMock.callListener(port);

      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: false,
      });
    });

    it("posts a message to the port indicating that the fileless import feature is disabled if the user's policy removes individual vaults", async () => {
      const port = createPortMock(FilelessImportPortNames.LpImporter);
      jest
        .spyOn(filelessImporterBackground as any, "removeIndividualVault")
        .mockResolvedValue(true);

      await onConnectMock.callListener(port);

      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: false,
      });
    });

    it("posts a message to the port indicating that the fileless import feature is disabled if the feature flag is turned off", async () => {
      const port = createPortMock(FilelessImportPortNames.LpImporter);
      jest.spyOn(configService, "getFeatureFlag").mockResolvedValue(false);

      await onConnectMock.callListener(port);

      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: false,
      });
    });

    it("posts a message to the port indicating that the fileless import feature is enabled", async () => {
      const port = createPortMock(FilelessImportPortNames.LpImporter);

      await onConnectMock.callListener(port);

      expect(port.postMessage).toHaveBeenCalledWith({
        command: "verifyFeatureFlag",
        filelessImportEnabled: true,
      });
    });
  });
});
