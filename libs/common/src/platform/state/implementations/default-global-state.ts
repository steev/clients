import {
  BehaviorSubject,
  Observable,
  defer,
  filter,
  firstValueFrom,
  shareReplay,
  switchMap,
  tap,
  timeout,
} from "rxjs";
import { Jsonify } from "type-fest";

import { AbstractStorageService } from "../../abstractions/storage.service";
import { GlobalState } from "../global-state";
import { KeyDefinition, globalKeyBuilder } from "../key-definition";
import { StateUpdateOptions, populateOptionsWithDefault } from "../state-update-options";

export class DefaultGlobalState<T> implements GlobalState<T> {
  private storageKey: string;
  private seededPromise: Promise<void>;

  protected stateSubject: BehaviorSubject<T | null> = new BehaviorSubject<T | null>(null);

  state$: Observable<T>;

  constructor(
    private keyDefinition: KeyDefinition<T>,
    private chosenLocation: AbstractStorageService
  ) {
    this.storageKey = globalKeyBuilder(this.keyDefinition);

    this.seededPromise = this.chosenLocation.get<Jsonify<T>>(this.storageKey).then((data) => {
      const serializedData = this.keyDefinition.deserializer(data);
      this.stateSubject.next(serializedData);
    });

    const storageUpdates$ = this.chosenLocation.updates$.pipe(
      filter((update) => update.key === this.storageKey),
      switchMap(async (update) => {
        if (update.updateType === "remove") {
          return null;
        }
        const jsonData = await this.chosenLocation.get<Jsonify<T>>(this.storageKey);
        const data = this.keyDefinition.deserializer(jsonData);
        return data;
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );

    this.state$ = defer(() => {
      const storageUpdateSubscription = storageUpdates$.subscribe((value) => {
        this.stateSubject.next(value);
      });

      return this.stateSubject.pipe(
        tap({
          complete: () => storageUpdateSubscription.unsubscribe(),
        })
      );
    });
  }

  async update<TCombine>(
    configureState: (state: T, dependency: TCombine) => T,
    options: StateUpdateOptions<T, TCombine> = {}
  ): Promise<T> {
    options = populateOptionsWithDefault(options);
    await this.seededPromise;
    const currentState = this.stateSubject.getValue();
    const combinedDependencies =
      options.combineLatestWith != null
        ? await firstValueFrom(options.combineLatestWith.pipe(timeout(options.msTimeout)))
        : null;

    if (!options.shouldUpdate(currentState, combinedDependencies)) {
      return;
    }

    const newState = configureState(currentState, combinedDependencies);
    await this.chosenLocation.save(this.storageKey, newState);
    return newState;
  }

  async getFromState(): Promise<T> {
    const data = await this.chosenLocation.get<Jsonify<T>>(this.storageKey);
    return this.keyDefinition.deserializer(data);
  }
}
