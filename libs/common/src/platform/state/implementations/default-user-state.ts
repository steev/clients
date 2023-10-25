import {
  Observable,
  BehaviorSubject,
  map,
  shareReplay,
  switchMap,
  tap,
  defer,
  firstValueFrom,
  combineLatestWith,
  filter,
} from "rxjs";
import { Jsonify } from "type-fest";

import { AccountService } from "../../../auth/abstractions/account.service";
import { UserId } from "../../../types/guid";
import { EncryptService } from "../../abstractions/encrypt.service";
import {
  AbstractStorageService,
  AbstractMemoryStorageService,
} from "../../abstractions/storage.service";
import { userKeyBuilder } from "../../misc/key-builders";
import { DerivedStateDefinition } from "../derived-state-definition";
import { DerivedUserState } from "../derived-user-state";
import { KeyDefinition } from "../key-definition";
import { StorageLocation } from "../state-definition";
import { UserState } from "../user-state";

const FAKE_DEFAULT = Symbol("fakeDefault");

export class DefaultUserState<T> implements UserState<T> {
  private formattedKey$: Observable<string>;
  private chosenStorageLocation: AbstractStorageService;

  protected stateSubject: BehaviorSubject<T | typeof FAKE_DEFAULT> = new BehaviorSubject<
    T | typeof FAKE_DEFAULT
  >(FAKE_DEFAULT);
  private stateSubject$ = this.stateSubject.asObservable();

  state$: Observable<T>;

  constructor(
    protected keyDefinition: KeyDefinition<T>,
    private accountService: AccountService,
    private encryptService: EncryptService,
    private memoryStorageService: AbstractMemoryStorageService,
    private secureStorageService: AbstractStorageService,
    private diskStorageService: AbstractStorageService
  ) {
    this.chosenStorageLocation = this.chooseStorage(
      this.keyDefinition.stateDefinition.storageLocation
    );
    this.formattedKey$ = this.accountService.activeAccount$.pipe(
      map((account) =>
        account != null && account.id != null
          ? userKeyBuilder(account.id, this.keyDefinition)
          : null
      ),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    const activeAccountData$ = this.formattedKey$.pipe(
      switchMap(async (key) => {
        if (key == null) {
          return FAKE_DEFAULT;
        }
        const jsonData = await this.chosenStorageLocation.get<Jsonify<T>>(key);
        const data = keyDefinition.deserializer(jsonData);
        return data;
      }),
      // Share the execution
      shareReplay({ refCount: false, bufferSize: 1 })
    );

    const storageUpdates$ = this.chosenStorageLocation.updates$.pipe(
      combineLatestWith(this.formattedKey$),
      filter(([update, key]) => key !== null && update.key === key),
      map(([update]) => {
        return keyDefinition.deserializer(update.value as Jsonify<T>);
      })
    );

    // Whomever subscribes to this data, should be notified of updated data
    // if someone calls my update() method, or the active user changes.
    this.state$ = defer(() => {
      const accountChangeSubscription = activeAccountData$.subscribe((data) => {
        this.stateSubject.next(data);
      });
      const storageUpdateSubscription = storageUpdates$.subscribe((data) => {
        this.stateSubject.next(data);
      });

      return this.stateSubject$.pipe(
        tap({
          complete: () => {
            accountChangeSubscription.unsubscribe();
            storageUpdateSubscription.unsubscribe();
          },
        })
      );
    })
      // I fake the generic here because I am filtering out the other union type
      // and this makes it so that typescript understands the true type
      .pipe(filter<T>((value) => value != FAKE_DEFAULT));
  }

  async update(configureState: (state: T) => T): Promise<T> {
    const key = await this.createKey();
    const currentState = await this.getGuaranteedState(key);
    const newState = configureState(currentState);
    await this.saveToStorage(key, newState);
    return newState;
  }

  async updateFor(userId: UserId, configureState: (state: T) => T): Promise<T> {
    if (userId == null) {
      throw new Error("Attempting to update user state, but no userId has been supplied.");
    }

    const key = userKeyBuilder(userId, this.keyDefinition);
    const currentStore = await this.chosenStorageLocation.get<Jsonify<T>>(key);
    const currentState = this.keyDefinition.deserializer(currentStore);
    const newState = configureState(currentState);
    await this.saveToStorage(key, newState);

    return newState;
  }

  async getFromState(): Promise<T> {
    const key = await this.createKey();
    const data = await this.chosenStorageLocation.get<Jsonify<T>>(key);
    return this.keyDefinition.deserializer(data);
  }

  createDerived<TTo>(
    derivedStateDefinition: DerivedStateDefinition<T, TTo>
  ): DerivedUserState<T, TTo> {
    return new DerivedUserState<T, TTo>(derivedStateDefinition, this.encryptService, this);
  }

  protected async createKey(): Promise<string> {
    const formattedKey = await firstValueFrom(this.formattedKey$);
    if (formattedKey == null) {
      throw new Error("Cannot create a key while there is no active user.");
    }
    return formattedKey;
  }

  protected async getGuaranteedState(key: string) {
    const currentValue = this.stateSubject.getValue();
    return currentValue === FAKE_DEFAULT ? await this.seedInitial(key) : currentValue;
  }

  private async seedInitial(key: string): Promise<T> {
    const data = await this.chosenStorageLocation.get<Jsonify<T>>(key);
    const serializedData = this.keyDefinition.deserializer(data);
    this.stateSubject.next(serializedData);
    return serializedData;
  }

  private chooseStorage(storageLocation: StorageLocation): AbstractStorageService {
    switch (storageLocation) {
      case "disk":
        return this.diskStorageService;
      case "secure":
        return this.secureStorageService;
      case "memory":
        return this.memoryStorageService;
    }
  }

  protected saveToStorage(key: string, data: T): Promise<void> {
    return this.chosenStorageLocation.save(key, data);
  }
}
