import { AbstractStorageService } from "../src/platform/abstractions/storage.service";
import { StorageOptions } from "../src/platform/models/domain/storage-options";

export class FakeStorageService extends AbstractStorageService {
  private store: Record<string, unknown>;

  constructor(initial?: Record<string, unknown>) {
    super();
    this.store = initial ?? {};
  }

  internalUpdateStore(store: Record<string, unknown>) {
    this.store = store;
  }

  get<T>(key: string, options?: StorageOptions): Promise<T> {
    const value = this.store[key] as T;
    return Promise.resolve(value);
  }
  has(key: string, options?: StorageOptions): Promise<boolean> {
    return Promise.resolve(this.store[key] != null);
  }
  save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    this.store[key] = obj;
    this.updatesSubject.next({ key: key, value: obj, updateType: "save" });
    return Promise.resolve();
  }
  remove(key: string, options?: StorageOptions): Promise<void> {
    delete this.store[key];
    this.updatesSubject.next({ key: key, value: undefined, updateType: "remove" });
    return Promise.resolve();
  }
}
