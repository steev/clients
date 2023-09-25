class LpFilelessImporter {
  private messagePort: chrome.runtime.Port;
  private readonly portMessageHandlers: Record<
    string,
    (msg: any, port: chrome.runtime.Port) => void
  > = {
    verifyFeatureFlag: (msg, port) => this.handleFeatureFlagVerification(msg),
    triggerCsvDownload: (msg) => this.postWindowMessage(msg),
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
   * @param msg - The port message, contains the feature flag indicator.
   */
  private handleFeatureFlagVerification(msg: any) {
    if (!msg.filelessImportFeatureFlagEnabled) {
      this.messagePort?.disconnect();
      return;
    }

    this.suppressDownload();
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
   * @param msg - The message to post.
   */
  private postWindowMessage(msg: any) {
    globalThis.postMessage(msg, "https://lastpass.com");
  }

  /**
   * Sets up the message port that is used to facilitate communication between the
   * background script and the content script.
   */
  private setupMessagePort() {
    this.messagePort = chrome.runtime.connect({ name: "lp-fileless-importer" });
    this.messagePort.onMessage.addListener(this.handlePortMessage);
  }

  /**
   * Handles messages that are sent from the background script.
   *
   * @param msg - The message that was sent.
   * @param port - The port that the message was sent from.
   */
  private handlePortMessage = (msg: any, port: chrome.runtime.Port) => {
    const handler = this.portMessageHandlers[msg.command];
    if (!handler) {
      return;
    }

    handler(msg, port);
  };
}

(function () {
  if (!(globalThis as any).lpFilelessImporter) {
    (globalThis as any).lpFilelessImporter = new LpFilelessImporter();
    (globalThis as any).lpFilelessImporter.init();
  }
})();
