import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import {
  LpFilelessImporter as LpFilelessImporterInterface,
  LpFilelessImporterMessageHandlers,
} from "./abstractions/lp-fileless-importer";

class LpFilelessImporter implements LpFilelessImporterInterface {
  private exportData: string;
  private messagePort: chrome.runtime.Port;
  private mutationObserver: MutationObserver;
  private readonly portMessageHandlers: LpFilelessImporterMessageHandlers = {
    verifyFeatureFlag: ({ message }) => this.handleFeatureFlagVerification(message),
    triggerCsvDownload: ({ message }) => this.postWindowMessage(message),
    startLpFilelessImport: () => this.startLpImport(),
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
  private handleFeatureFlagVerification(message: any) {
    if (!message.filelessImportFeatureFlagEnabled) {
      this.messagePort?.disconnect();
      return;
    }

    this.suppressDownload();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.loadImporter);
      return;
    }

    this.loadImporter();
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
   * Initializes the importing mechanism used to import the CSV file into Bitwarden.
   * This is done by observing the DOM for the addition of the LP importer element.
   */
  private loadImporter = () => {
    this.mutationObserver = new MutationObserver(this.handleMutation);
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  /**
   * Handles mutations that are observed by the mutation observer. When the exported data
   * element is added to the DOM, the export data is extracted and the import prompt is
   * displayed.
   *
   * @param mutations - The mutations that were observed.
   */
  private handleMutation = (mutations: MutationRecord[]) => {
    if (!mutations?.length) {
      return;
    }

    for (let index = 0; index < mutations.length; index++) {
      const mutation: MutationRecord = mutations[index];
      if (!mutation.addedNodes?.length) {
        continue;
      }

      for (let index = 0; index < mutation.addedNodes.length; index++) {
        const addedNode: Node = mutation.addedNodes[index];

        const tagName: string = addedNode.nodeName.toLowerCase();
        if (tagName !== "pre") {
          continue;
        }

        const preElement: HTMLPreElement = addedNode as HTMLPreElement;
        const textContent: string = preElement.textContent?.trim();
        if (!textContent) {
          continue;
        }

        this.exportData = textContent;
        this.displayImportNotification();
        this.mutationObserver.disconnect();
      }
    }
  };

  /**
   * Posts a message to the notification bar content script to display the import prompt.
   */
  private displayImportNotification() {
    if (!this.exportData) {
      return;
    }

    this.postPortMessage({ command: "displayLpImportNotification" });
  }

  /**
   * Posts a message to the background script.
   *
   * @param message - The message to post.
   */
  private postPortMessage(message: any) {
    this.messagePort?.postMessage(message);
  }

  /**
   * Posts a message to the global context of the page.
   *
   * @param message - The message to post.
   */
  private postWindowMessage(message: any) {
    globalThis.postMessage(message, "https://lastpass.com");
  }

  private startLpImport() {
    if (!this.exportData) {
      return;
    }

    this.postPortMessage({ command: "startLpImport", data: this.exportData });
    this.messagePort?.disconnect();
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
