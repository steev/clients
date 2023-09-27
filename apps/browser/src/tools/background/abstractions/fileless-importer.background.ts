type LpImporterMessageHandlers = {
  [key: string]: ({ message, port }: { message: any; port: chrome.runtime.Port }) => void;
};

export { LpImporterMessageHandlers };
