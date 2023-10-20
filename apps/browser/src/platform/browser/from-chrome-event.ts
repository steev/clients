import { Observable } from "rxjs";

export function fromChromeEvent<T extends unknown[]>(
  event: chrome.events.Event<(...args: T) => void>
): Observable<T> {
  return new Observable<T>((subscriber) => {
    const handler = (...args: T) => {
      if (chrome.runtime.lastError) {
        subscriber.error(chrome.runtime.lastError);
        return;
      }

      subscriber.next(args);
    };

    event.addListener(handler);

    return () => event.removeListener(handler);
  });
}
