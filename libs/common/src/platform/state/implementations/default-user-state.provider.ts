import { AccountService } from "../../../auth/abstractions/account.service";
import { EncryptService } from "../../abstractions/encrypt.service";
import {
  AbstractMemoryStorageService,
  AbstractStorageService,
} from "../../abstractions/storage.service";
import { KeyDefinition } from "../key-definition";
import { StorageLocation } from "../state-definition";
import { UserState } from "../user-state";
import { UserStateProvider } from "../user-state.provider";

import { DefaultUserState } from "./default-user-state";

export class DefaultUserStateProvider implements UserStateProvider {
  private userStateCache: Record<string, UserState<unknown>> = {};

  constructor(
    protected accountService: AccountService, // Inject the lightest weight service that provides accountUserId$
    protected encryptService: EncryptService,
    protected memoryStorage: AbstractMemoryStorageService,
    protected diskStorage: AbstractStorageService,
    protected secureStorage: AbstractStorageService
  ) {}

  get<T>(keyDefinition: KeyDefinition<T>): UserState<T> {
    const locationDomainKey = `${keyDefinition.stateDefinition.storageLocation}_${keyDefinition.stateDefinition.name}_${keyDefinition.key}`;
    const existingUserState = this.userStateCache[locationDomainKey];
    if (existingUserState != null) {
      // I have to cast out of the unknown generic but this should be safe if rules
      // around domain token are made
      return existingUserState as DefaultUserState<T>;
    }

    const newUserState = this.buildUserState(keyDefinition);
    this.userStateCache[locationDomainKey] = newUserState;
    return newUserState;
  }

  protected buildUserState<T>(keyDefinition: KeyDefinition<T>): UserState<T> {
    return new DefaultUserState<T>(
      keyDefinition,
      this.accountService,
      this.encryptService,
      this.getLocation(keyDefinition.stateDefinition.storageLocation)
    );
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
