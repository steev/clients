import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";

class FilelessImporterBackground {
  private lpImporterPort: chrome.runtime.Port;
  private readonly lpImporterPortMessageHandlers: Record<
    string,
    (msg: any, port: chrome.runtime.Port) => void
  > = {};

  constructor(private configService: ConfigServiceAbstraction) {
    this.setupExtensionMessageListeners();
  }

  private triggerLpImporterCsvDownload() {
    if (!this.lpImporterPort) {
      return;
    }

    this.lpImporterPort.postMessage({
      command: "triggerCsvDownload",
    });
  }

  private setupExtensionMessageListeners() {
    chrome.runtime.onConnect.addListener(this.handlePortOnConnect);
  }

  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    const filelessImportFeatureFlag = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.BrowserFilelessImport
    );
    port.postMessage({
      command: "verifyFeatureFlag",
      filelessImportFeatureFlag: filelessImportFeatureFlag,
    });

    if (!filelessImportFeatureFlag) {
      port.disconnect();
      return;
    }

    port.onMessage.addListener(this.handleImporterPortMessage);
    port.onDisconnect.addListener(this.handleImporterPortDisconnect);

    if (port.name === "lp-fileless-importer") {
      this.lpImporterPort = port;
    }
  };

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

  private handleImporterPortDisconnect = (port: chrome.runtime.Port) => {
    if (port.name === "lp-fileless-importer") {
      this.lpImporterPort = null;
    }
  };
}

export default FilelessImporterBackground;
