import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import {
  LpFilelessImporter as LpFilelessImporterInterface,
  LpFilelessImporterMessageHandlers,
} from "./abstractions/lp-fileless-importer";

class LpFilelessImporter implements LpFilelessImporterInterface {
  private messagePort: chrome.runtime.Port;
  private readonly portMessageHandlers: LpFilelessImporterMessageHandlers = {
    verifyFeatureFlag: ({ message }) => this.handleFeatureFlagVerification(message),
    triggerCsvDownload: () => this.triggerCsvDownload(),
  };

  /**
   * Initializes the LP fileless importer.
   */
  init() {
    this.setupMessagePort();
  }

  /**
   * Enacts behavior based on the feature flag verification message. If the feature flag is
   * not enabled, the message port is disconnected. If the feature flag is enabled, the
   * download of the CSV file is suppressed.
   *
   * @param message - The port message, contains the feature flag indicator.
   */
  handleFeatureFlagVerification(message: any) {
    if (!message.filelessImportEnabled) {
      this.messagePort?.disconnect();
      return;
    }

    this.suppressDownload();
  }

  /**
   * Posts a message to the LP importer to trigger the download of the CSV file.
   */
  triggerCsvDownload() {
    this.postWindowMessage({ command: "triggerCsvDownload" });
  }

  /**
   * Suppresses the download of the CSV file by overriding the `download` attribute of the
   * anchor element that is created by the LP importer. This is done by injecting a script
   * into the page that overrides the `appendChild` method of the `Element` prototype.
   */
  private suppressDownload() {
    const script = document.createElement("script");
    script.textContent = `
    let csvDownload = '';
    let csvHref = '';
    const defaultAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function (newChild) {
      if (newChild.nodeName.toLowerCase() === 'a' && newChild.download) {
        csvDownload = newChild.download;
        csvHref = newChild.href;
        newChild.setAttribute('href', 'javascript:void(0)');
        newChild.setAttribute('download', '');
        Element.prototype.appendChild = defaultAppendChild;
      }

      return defaultAppendChild.call(this, newChild);
    };

    window.addEventListener('message', (event) => {
      const command = event.data?.command;
      if (event.source !== window || command !== 'triggerCsvDownload') {
        return;
      }

      const anchor = document.createElement('a');
      anchor.setAttribute('href', csvHref);
      anchor.setAttribute('download', csvDownload);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });
  `;
    document.documentElement.appendChild(script);
  }

  /**
   * Posts a message to the global context of the page.
   *
   * @param message - The message to post.
   */
  private postWindowMessage(message: any) {
    globalThis.postMessage(message, "https://lastpass.com");
  }

  /**
   * Sets up the message port that is used to facilitate communication between the
   * background script and the content script.
   */
  private setupMessagePort() {
    this.messagePort = chrome.runtime.connect({ name: FilelessImportPortNames.LpImport });
    this.messagePort.onMessage.addListener(this.handlePortMessage);
  }

  /**
   * Handles messages that are sent from the background script.
   *
   * @param message - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handlePortMessage = (message: any, port: chrome.runtime.Port) => {
    const handler = this.portMessageHandlers[message.command];
    if (!handler) {
      return;
    }

    handler({ message, port });
  };
}

(function () {
  if (!(globalThis as any).lpFilelessImporter) {
    (globalThis as any).lpFilelessImporter = new LpFilelessImporter();
    (globalThis as any).lpFilelessImporter.init();
  }
})();
