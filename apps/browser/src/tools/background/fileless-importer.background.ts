import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ImportServiceAbstraction } from "@bitwarden/importer";

import NotificationBackground from "../../autofill/background/notification.background";
import { BrowserApi } from "../../platform/browser/browser-api";
import { FilelessImportPortNames, FilelessImportType } from "../enums/fileless-import.enums";

import {
  ImportNotificationMessageHandlers,
  LpImporterMessageHandlers,
} from "./abstractions/fileless-importer.background";

class FilelessImporterBackground {
  private static readonly filelessImporterPortNames: Set<string> = new Set([
    FilelessImportPortNames.LpImport,
    FilelessImportPortNames.NotificationBar,
  ]);
  private importNotificationsPort: chrome.runtime.Port;
  private lpImporterPort: chrome.runtime.Port;
  private readonly importNotificationsPortMessageHandlers: ImportNotificationMessageHandlers = {
    startFilelessImport: ({ message }) => this.startFilelessImport(message.importType),
    cancelFilelessImport: ({ message, port }) =>
      this.cancelFilelessImport(message.importType, port.sender),
  };
  private readonly lpImporterPortMessageHandlers: LpImporterMessageHandlers = {
    displayLpImportNotification: ({ port }) =>
      this.displayFilelessImportNotification(port.sender.tab, FilelessImportType.LP),
    startLpImport: ({ message }) => this.triggerLpImport(message.data),
  };

  constructor(
    private configService: ConfigServiceAbstraction,
    private authService: AuthService,
    private policyService: PolicyService,
    private notificationBackground: NotificationBackground,
    private importService: ImportServiceAbstraction,
    private syncService: SyncService
  ) {
    this.setupExtensionMessageListeners();
  }

  /**
   * Starts an import of the export data pulled from the tab.
   *
   * @param importType - The type of import to start. Identifies the used content script.
   */
  private startFilelessImport(importType: string) {
    if (importType === FilelessImportType.LP) {
      this.lpImporterPort?.postMessage({ command: "startLpFilelessImport" });
    }
  }

  /**
   * Cancels an import of the export data pulled from the tab. This closes any
   * existing notifications that are present in the tab, and triggers importer
   * specific behavior based on the import type.
   *
   * @param importType - The type of import to cancel. Identifies the used content script.
   * @param sender - The sender of the message.
   */
  private async cancelFilelessImport(importType: string, sender: chrome.runtime.MessageSender) {
    if (importType === FilelessImportType.LP) {
      this.triggerLpImporterCsvDownload();
    }

    await BrowserApi.tabSendMessageData(sender.tab, "closeNotificationBar");
  }

  /**
   * Injects the notification bar into the passed tab.
   *
   * @param tab
   * @param importType
   * @private
   */
  private async displayFilelessImportNotification(tab: chrome.tabs.Tab, importType: string) {
    await this.notificationBackground.requestFilelessImport(tab, importType);
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
   * Completes the import process for the LP importer. This is triggered when the
   * user opts to save the export to Bitwarden within the notification bar.
   *
   * @param data - The export data to import.
   * @param sender - The sender of the message.
   */
  private async triggerLpImport(data: string) {
    if (!data) {
      return;
    }

    const promptForPassword_callback = async () => "";
    const importer = this.importService.getImporter(
      "lastpasscsv",
      promptForPassword_callback,
      null
    );

    try {
      const result = await this.importService.import(importer, data, null, null, false);
      if (result.success) {
        this.importNotificationsPort?.postMessage({ command: "filelessImportCompleted" });
        await this.syncService.fullSync(true);
      }
    } catch (error) {
      this.importNotificationsPort?.postMessage({
        command: "filelessImportFailed",
        importErrorMessage: error,
      });
    }
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

    if (port.name === FilelessImportPortNames.LpImport) {
      this.lpImporterPort = port;
    }

    if (port.name === FilelessImportPortNames.NotificationBar) {
      this.importNotificationsPort = port;
    }
  };

  /**
   * Handles messages that are sent from fileless importer content scripts.
   * @param message - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handleImporterPortMessage = (message: any, port: chrome.runtime.Port) => {
    let handler: CallableFunction | undefined;

    if (port.name === FilelessImportPortNames.LpImport) {
      handler = this.lpImporterPortMessageHandlers[message.command];
    }

    if (port.name === FilelessImportPortNames.NotificationBar) {
      handler = this.importNotificationsPortMessageHandlers[message.command];
    }

    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  /**
   * Handles disconnections from fileless importer content scripts.
   * @param port - The port that was disconnected.
   */
  private handleImporterPortDisconnect = (port: chrome.runtime.Port) => {
    if (port.name === FilelessImportPortNames.LpImport) {
      this.lpImporterPort = null;
    }
  };
}

export default FilelessImporterBackground;
