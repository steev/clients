import { ipcRenderer } from "electron";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { StorageOptions } from "@bitwarden/common/platform/models/domain/storage-options";

export class ElectronRendererSecureStorageService extends AbstractStorageService {
  async get<T>(key: string, options?: StorageOptions): Promise<T> {
    const val = await ipcRenderer.invoke("keytar", {
      action: "getPassword",
      key: key,
      keySuffix: options?.keySuffix ?? "",
    });
    return val != null ? (JSON.parse(val) as T) : null;
  }

  async has(key: string, options?: StorageOptions): Promise<boolean> {
    const val = await ipcRenderer.invoke("keytar", {
      action: "hasPassword",
      key: key,
      keySuffix: options?.keySuffix ?? "",
    });
    return !!val;
  }

  async save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    await ipcRenderer.invoke("keytar", {
      action: "setPassword",
      key: key,
      keySuffix: options?.keySuffix ?? "",
      value: JSON.stringify(obj),
    });
    this.updatesSubject.next({ key, value: obj, updateType: "save" });
  }

  async remove(key: string, options?: StorageOptions): Promise<void> {
    await ipcRenderer.invoke("keytar", {
      action: "deletePassword",
      key: key,
      keySuffix: options?.keySuffix ?? "",
    });
    this.updatesSubject.next({ key, value: null, updateType: "remove" });
  }
}
