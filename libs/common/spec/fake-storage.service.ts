import { MockProxy, mock } from "jest-mock-extended";

import { AbstractStorageService } from "../src/platform/abstractions/storage.service";
import { StorageOptions } from "../src/platform/models/domain/storage-options";

export class FakeStorageService extends AbstractStorageService {
  private store: Record<string, unknown>;

  /**
   * Returns a mock of a {@see AbstractStorageService} for asserting the expected
   * amount of calls. It is not recommended to use this to mock implementations as
   * they are not respected.
   */
  mock: MockProxy<AbstractStorageService>;

  constructor(initial?: Record<string, unknown>) {
    super();
    this.store = initial ?? {};
    this.mock = mock<AbstractStorageService>();
  }

  /**
   * Updates the internal store for this fake implementation, this bypasses any mock calls
   * or updates to the {@link updates$} observable.
   * @param store
   */
  internalUpdateStore(store: Record<string, unknown>) {
    this.store = store;
  }

  get<T>(key: string, options?: StorageOptions): Promise<T> {
    this.mock.get(key, options);
    const value = this.store[key] as T;
    return Promise.resolve(value);
  }
  has(key: string, options?: StorageOptions): Promise<boolean> {
    this.mock.has(key, options);
    return Promise.resolve(this.store[key] != null);
  }
  save<T>(key: string, obj: T, options?: StorageOptions): Promise<void> {
    this.mock.save(key, options);
    this.store[key] = obj;
    this.updatesSubject.next({ key: key, value: obj, updateType: "save" });
    return Promise.resolve();
  }
  remove(key: string, options?: StorageOptions): Promise<void> {
    this.mock.remove(key, options);
    delete this.store[key];
    this.updatesSubject.next({ key: key, value: undefined, updateType: "remove" });
    return Promise.resolve();
  }
}
