import { Observable, Subject, filter, firstValueFrom, map } from "rxjs";

import {
  AbstractMemoryStorageService,
  StorageUpdate,
  StorageUpdateType,
} from "@bitwarden/common/platform/abstractions/storage.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { fromChromeEvent } from "../browser/from-chrome-event";

import { MemoryStoragePortMessage } from "./port-messages";
import { portName } from "./port-name";

export class ForegroundMemoryStorageService extends AbstractMemoryStorageService {
  private _port: chrome.runtime.Port;
  private _backgroundResponses$: Observable<MemoryStoragePortMessage>;
  private updatesSubject = new Subject<StorageUpdate>();

  get updates$(): Observable<StorageUpdate> {
    return this.updatesSubject.asObservable();
  }

  constructor() {
    super();

    this._port = chrome.runtime.connect({ name: portName(chrome.storage.session) });
    this._backgroundResponses$ = fromChromeEvent(this._port.onMessage).pipe(
      map(([message]) => message),
      filter((message) => message.originator === "background")
    );

    this._backgroundResponses$
      .pipe(
        filter(
          (message) => message.action === "subject_update" || message.action === "initialization"
        )
      )
      .subscribe((message) => {
        switch (message.action) {
          case "initialization":
            this.handleInitialize(message.data as [string, unknown][]); // Map entries as array
            break;
          case "subject_update":
            this.handleSubjectUpdate(
              message.data as {
                key: string;
                value: unknown;
                updateType: StorageUpdateType;
              }
            );
            break;
          default:
            throw new Error(`Unknown action: ${message.action}`);
        }
      });
  }

  async get<T>(key: string): Promise<T> {
    return await this.delegateToBackground<T>("get", key);
  }
  async getBypassCache<T>(key: string): Promise<T> {
    return await this.delegateToBackground<T>("getBypassCache", key);
  }
  async has(key: string): Promise<boolean> {
    return await this.delegateToBackground<boolean>("has", key);
  }
  async save<T>(key: string, obj: T): Promise<void> {
    await this.delegateToBackground<T>("save", key, obj);
  }
  async remove(key: string): Promise<void> {
    await this.delegateToBackground<void>("remove", key);
  }

  private async delegateToBackground<T>(
    action: MemoryStoragePortMessage["action"],
    key: string,
    data?: T
  ): Promise<T> {
    const id = Utils.newGuid();
    // listen for response before request
    const response = firstValueFrom(
      this._backgroundResponses$.pipe(
        filter((message) => message.id === id),
        map((message) => message.data as T)
      )
    );

    this.sendMessage({
      id: id,
      key: key,
      action: action,
      data: data,
    });

    const result = await response;
    return result;
  }

  private sendMessage(data: Omit<MemoryStoragePortMessage, "originator">) {
    this._port.postMessage({
      ...data,
      originator: "foreground",
    });
  }

  private handleInitialize(data: [string, unknown][]) {
    // TODO: this isn't a save, but we don't have a better indicator for this
    data.forEach(([key, value]) => {
      this.updatesSubject.next({ key, value, updateType: "save" });
    });
  }

  private handleSubjectUpdate(data: {
    key: string;
    value: unknown;
    updateType: StorageUpdateType;
  }) {
    this.updatesSubject.next(data);
  }
}
