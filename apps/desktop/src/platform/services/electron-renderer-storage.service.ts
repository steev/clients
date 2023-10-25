import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

export class ElectronRendererStorageService extends AbstractStorageService {
  get<T>(key: string): Promise<T> {
    return ipc.platform.storage.get(key);
  }

  has(key: string): Promise<boolean> {
    return ipc.platform.storage.has(key);
  }

  async save<T>(key: string, obj: T): Promise<void> {
    await ipc.platform.storage.save(key, obj);
    this.updatesSubject.next({ key, value: obj, updateType: "save" });
  }

  async remove(key: string): Promise<void> {
    await ipc.platform.storage.remove(key);
    this.updatesSubject.next({ key, value: null, updateType: "remove" });
  }
}
