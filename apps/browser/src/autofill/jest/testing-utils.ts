function triggerTestFailure() {
  expect(true).toBe("Test has failed.");
}

function sendPortMessage(port: chrome.runtime.Port, message: any) {
  (port.onMessage.addListener as unknown as jest.SpyInstance).mock.calls.forEach((call) => {
    const callback = call[0];
    callback(message || {}, port);
  });
}

export { triggerTestFailure, sendPortMessage };
