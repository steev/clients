import { Observable } from "rxjs";

export function fromChromeEvent<
  T extends (...args: unknown[]) => void,
  P extends unknown[] = Parameters<T>
>(target: chrome.events.Event<T>): Observable<P> {
  return new Observable<P>((subscriber) => {
    const handler = (...args: P) => {
      if (chrome.runtime.lastError) {
        subscriber.error(chrome.runtime.lastError);
        return;
      }
      subscriber.next(args);
    };
    // TODO: why do I need to fake this
    target.addListener(handler as T);

    return () => target.removeListener(handler as T);
  });
}
