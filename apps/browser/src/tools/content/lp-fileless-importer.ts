class LpFilelessImporter {
  private messagePort: chrome.runtime.Port;
  private readonly portMessageHandlers: Record<
    string,
    (msg: any, port: chrome.runtime.Port) => void
  > = {
    verifyFeatureFlag: (msg, port) => this.handleFeatureFlagVerification(msg),
    triggerCsvDownload: (msg) => this.postWindowMessage(msg),
  };

  init() {
    this.setupMessagePort();
  }

  private handleFeatureFlagVerification(msg: any) {
    if (!msg.filelessImportFeatureFlagEnabled) {
      this.messagePort?.disconnect();
      return;
    }

    this.suppressDownload();
  }

  private suppressDownload() {
    const script = document.createElement("script");
    script.textContent = `
    let href = '';
    let download = '';
    const defaultAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function (newChild) {
      if (newChild.nodeName.toLowerCase() === 'a' && newChild.download) {
        download = newChild.download;
        href = newChild.href;
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
      anchor.setAttribute('href', href);
      anchor.setAttribute('download', download);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });
  `;
    document.documentElement.appendChild(script);
  }

  private postWindowMessage(msg: any) {
    window.postMessage(msg, "https://lastpass.com");
  }

  private setupMessagePort() {
    this.messagePort = chrome.runtime.connect({ name: "lp-fileless-importer" });
    this.messagePort.onMessage.addListener(this.handlePortMessage);
  }

  private handlePortMessage = (msg: any, port: chrome.runtime.Port) => {
    const handler = this.portMessageHandlers[msg.command];
    if (!handler) {
      return;
    }

    handler(msg, port);
  };
}

(function () {
  if (!(globalThis as any).lpImporter) {
    (globalThis as any).lpImporter = new LpFilelessImporter();
    (globalThis as any).lpImporter.init();
  }
})();
