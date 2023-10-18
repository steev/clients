import { Observable, mergeMap } from "rxjs";

import {
  AbstractStorageService,
  StorageUpdateType,
} from "@bitwarden/common/platform/abstractions/storage.service";

import { fromChromeEvent } from "../../browser/from-chrome-event";

export default abstract class AbstractChromeStorageService extends AbstractStorageService {
  constructor(protected chromeStorageApi: chrome.storage.StorageArea) {
    super();
  }

  override get updates$(): Observable<{
    key: string;
    value: unknown;
    updateType: StorageUpdateType;
  }> {
    return fromChromeEvent(this.chromeStorageApi.onChanged).pipe(
      mergeMap(([changes]) => {
        return Object.entries(changes).map(([key, change]) => {
          const newValue = change.newValue;
          // I'm not sure the != null is the greatest determinator of if it's a remove
          return {
            key: key,
            value: newValue,
            updateType: (newValue != null ? "save" : "remove") as StorageUpdateType,
          };
        });
      })
    );
  }

  async get<T>(key: string): Promise<T> {
    return new Promise((resolve) => {
      this.chromeStorageApi.get(key, (obj: any) => {
        if (obj != null && obj[key] != null) {
          resolve(obj[key] as T);
          return;
        }
        resolve(null);
      });
    });
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) != null;
  }

  async save(key: string, obj: any): Promise<void> {
    if (obj == null) {
      // Fix safari not liking null in set
      return this.remove(key);
    }

    if (obj instanceof Set) {
      obj = Array.from(obj);
    }

    const keyedObj = { [key]: obj };
    return new Promise<void>((resolve) => {
      this.chromeStorageApi.set(keyedObj, () => {
        resolve();
      });
    });
  }

  async remove(key: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.chromeStorageApi.remove(key, () => {
        resolve();
      });
    });
  }
}
