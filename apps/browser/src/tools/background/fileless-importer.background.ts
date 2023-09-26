import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";

class FilelessImporterBackground {
  private static readonly filelessImporterPortNames = new Set(["lp-fileless-importer"]);
  private lpImporterPort: chrome.runtime.Port;
  private readonly lpImporterPortMessageHandlers: Record<
    string,
    (message: any, port: chrome.runtime.Port) => void
  > = {};

  constructor(
    private configService: ConfigServiceAbstraction,
    private authService: AuthService,
    private policyService: PolicyService
  ) {
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
   * Identifies if the user account has a policy that disables personal ownership.
   */
  private async removeIndividualVault(): Promise<boolean> {
    return await firstValueFrom(
      this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
    );
  }

  /**
   * Sets up onConnect listeners for the extension.
   */
  private setupExtensionMessageListeners() {
    chrome.runtime.onConnect.addListener(this.handlePortOnConnect);
  }

  /**
   * Handles connections from content scripts that affect the fileless importer behavior.
   * Is used to facilitate the passing of data and user actions to enact the import
   * of web content to the Bitwarden vault. Along with this, a check is made to ensure
   * that the feature flag is enabled and the user is authenticated.
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    if (!FilelessImporterBackground.filelessImporterPortNames.has(port.name)) {
      return;
    }

    const filelessImportFeatureFlagEnabled = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.BrowserFilelessImport
    );
    const userAuthStatus = await this.authService.getAuthStatus();
    const removeIndividualVault = await this.removeIndividualVault();
    const filelessImportEnabled =
      filelessImportFeatureFlagEnabled &&
      userAuthStatus === AuthenticationStatus.Unlocked &&
      !removeIndividualVault;
    port.postMessage({ command: "verifyFeatureFlag", filelessImportEnabled });

    if (!filelessImportEnabled) {
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
   * @param message - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handleImporterPortMessage = (message: any, port: chrome.runtime.Port) => {
    let handler: CallableFunction | undefined;

    if (port.name === "lp-fileless-importer") {
      handler = this.lpImporterPortMessageHandlers[message.command];
    }

    if (!handler) {
      return;
    }

    handler(message, port);
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
