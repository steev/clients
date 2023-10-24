import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "../../abstractions/storage.service";
import { GlobalState } from "../global-state";
import { GlobalStateProvider } from "../global-state.provider";
import { KeyDefinition } from "../key-definition";
import { StorageLocation } from "../state-definition";

import { DefaultGlobalState } from "./default-global-state";

export class DefaultGlobalStateProvider implements GlobalStateProvider {
  private globalStateCache: Record<string, GlobalState<unknown>> = {};

  constructor(
    private memoryStorage: AbstractMemoryStorageService,
    private diskStorage: AbstractStorageService,
    private secureStorage: AbstractStorageService
  ) {}

  get<T>(keyDefinition: KeyDefinition<T>): GlobalState<T> {
    const locationDomainKey = `${keyDefinition.stateDefinition.storageLocation}_${keyDefinition.stateDefinition.name}_${keyDefinition.key}`;
    const existingGlobalState = this.globalStateCache[locationDomainKey];
    if (existingGlobalState != null) {
      // The cast into the actual generic is safe because of rules around key definitions
      // being unique.
      return existingGlobalState as DefaultGlobalState<T>;
    }

    const newGlobalState = new DefaultGlobalState<T>(
      keyDefinition,
      this.getLocation(keyDefinition.stateDefinition.storageLocation)
    );

    this.globalStateCache[locationDomainKey] = newGlobalState;
    return newGlobalState;
  }

  private getLocation(location: StorageLocation) {
    switch (location) {
      case "disk":
        return this.diskStorage;
      case "secure":
        return this.secureStorage;
      case "memory":
        return this.memoryStorage;
    }
  }
}
