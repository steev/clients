type LpFilelessImporterMessageHandlers = {
  [key: string]: ({ message, port }: { message: any; port: chrome.runtime.Port }) => void;
  verifyFeatureFlag: ({ message }: { message: any }) => void;
  triggerCsvDownload: ({ message }: { message: any }) => void;
};

interface LpFilelessImporter {
  init(): void;
}

export { LpFilelessImporterMessageHandlers, LpFilelessImporter };
