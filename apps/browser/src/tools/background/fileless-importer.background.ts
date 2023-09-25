import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";

import NotificationBackground from "../../autofill/background/notification.background";
import { BrowserApi } from "../../platform/browser/browser-api";
import { FilelessImportPortNames, FilelessImportType } from "../enums/fileless-import.enums";

import {
  ImportNotificationMessageHandlers,
  LpImporterMessageHandlers,
} from "./abstractions/fileless-importer.background";

class FilelessImporterBackground {
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
  };

  constructor(
    private configService: ConfigServiceAbstraction,
    private authService: AuthService,
    private notificationBackground: NotificationBackground
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
      // Start import
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
