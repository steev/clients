import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";

class FilelessImporterBackground {
  private lpImporterPort: chrome.runtime.Port;
  private readonly lpImporterPortMessageHandlers: Record<
    string,
    (msg: any, port: chrome.runtime.Port) => void
  > = {};

  constructor(private configService: ConfigServiceAbstraction, private authService: AuthService) {
    this.setupExtensionMessageListeners();
  }

  /**
   * Triggers the download of the CSV file from the LP importer. This is triggered
   * when the user opts to not save the export to Bitwarden within the notification bar.
   */
  private triggerLpImporterCsvDownload() {
    this.lpImporterPort?.postMessage({ command: "triggerCsvDownload" });
    this.lpImporterPort?.disconnect();
  }

  /**
   * Sets up onConnect listeners for the extension.
   */
  private setupExtensionMessageListeners() {
    chrome.runtime.onConnect.addListener(this.handlePortOnConnect);
  }

  /**
   * Handles connections that are made from fileless importer content scripts.
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    const userAuthStatus = await this.authService.getAuthStatus();
    const filelessImportFeatureFlag = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.BrowserFilelessImport
    );
    const filelessImportFeatureFlagEnabled =
      filelessImportFeatureFlag && userAuthStatus === AuthenticationStatus.Unlocked;
    port.postMessage({
      command: "verifyFeatureFlag",
      filelessImportFeatureFlagEnabled: filelessImportFeatureFlagEnabled,
    });

    if (!filelessImportFeatureFlagEnabled) {
      port.disconnect();
      return;
    }

    port.onMessage.addListener(this.handleImporterPortMessage);
    port.onDisconnect.addListener(this.handleImporterPortDisconnect);

    if (port.name === "lp-fileless-importer") {
      this.lpImporterPort = port;
    }
  };

  /**
   * Handles messages that are sent from fileless importer content scripts.
   * @param msg - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handleImporterPortMessage = (msg: any, port: chrome.runtime.Port) => {
    let handler: CallableFunction | undefined;

    if (port.name === "lp-fileless-importer") {
      handler = this.lpImporterPortMessageHandlers[msg.command];
    }

    if (!handler) {
      return;
    }

    handler(msg, port);
  };

  /**
   * Handles disconnections from fileless importer content scripts.
   * @param port - The port that was disconnected.
   */
  private handleImporterPortDisconnect = (port: chrome.runtime.Port) => {
    if (port.name === "lp-fileless-importer") {
      this.lpImporterPort = null;
    }
  };
}

export default FilelessImporterBackground;
