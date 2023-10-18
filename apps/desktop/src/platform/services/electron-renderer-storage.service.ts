import { ipcRenderer } from "electron";

import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

export class ElectronRendererStorageService extends AbstractStorageService {
  get<T>(key: string): Promise<T> {
    return ipcRenderer.invoke("storageService", {
      action: "get",
      key: key,
    });
  }

  has(key: string): Promise<boolean> {
    return ipcRenderer.invoke("storageService", {
      action: "has",
      key: key,
    });
  }

  async save<T>(key: string, obj: T): Promise<void> {
    await ipcRenderer.invoke("storageService", {
      action: "save",
      key: key,
      obj: obj,
    });
    this.updatesSubject.next({ key, value: obj, updateType: "save" });
  }

  async remove(key: string): Promise<void> {
    await ipcRenderer.invoke("storageService", {
      action: "remove",
      key: key,
    });
    this.updatesSubject.next({ key, value: null, updateType: "remove" });
  }
}
