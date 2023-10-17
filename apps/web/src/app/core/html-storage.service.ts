import { Injectable } from "@angular/core";

import { HtmlStorageLocation } from "@bitwarden/common/enums";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

@Injectable()
export class HtmlStorageService extends AbstractStorageService {
  get defaultOptions(): StorageOptions {
    return { htmlStorageLocation: HtmlStorageLocation.Session };
  }

  get<T>(key: string, options: StorageOptions = this.defaultOptions): Promise<T> {
    let json: string = null;
    switch (options.htmlStorageLocation) {
      case HtmlStorageLocation.Local:
        json = window.localStorage.getItem(key);
        break;
      case HtmlStorageLocation.Session:
      default:
        json = window.sessionStorage.getItem(key);
        break;
    }

    if (json != null) {
      const obj = JSON.parse(json);
      return Promise.resolve(obj as T);
    }
    return Promise.resolve(null);
  }

  async has(key: string, options: StorageOptions = this.defaultOptions): Promise<boolean> {
    return (await this.get(key, options)) != null;
  }

  save(key: string, obj: any, options: StorageOptions = this.defaultOptions): Promise<any> {
    if (obj == null) {
      return this.remove(key, options);
    }

    if (obj instanceof Set) {
      obj = Array.from(obj);
    }

    const json = JSON.stringify(obj);
    switch (options.htmlStorageLocation) {
      case HtmlStorageLocation.Local:
        window.localStorage.setItem(key, json);
        break;
      case HtmlStorageLocation.Session:
      default:
        window.sessionStorage.setItem(key, json);
        break;
    }
    this.updatesSubject.next({ key, value: obj, updateType: "save" });
    return Promise.resolve();
  }

  remove(key: string, options: StorageOptions = this.defaultOptions): Promise<any> {
    switch (options.htmlStorageLocation) {
      case HtmlStorageLocation.Local:
        window.localStorage.removeItem(key);
        break;
      case HtmlStorageLocation.Session:
      default:
        window.sessionStorage.removeItem(key);
        break;
    }
    this.updatesSubject.next({ key, value: null, updateType: "remove" });
    return Promise.resolve();
  }
}