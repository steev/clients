import { Observable } from "rxjs";

import { UserId } from "../../types/guid";

import { DerivedStateDefinition, DerivedUserState } from ".";

/**
 * A helper object for interacting with state that is scoped to a specific user.
 */
export interface UserState<T> {
  readonly state$: Observable<T>;
  readonly getFromState: () => Promise<T>;
  /**
   * Updates backing stores for the active user.
   * @param configureState function that takes the current state and returns the new state
   * @returns The new state
   */
  readonly update: (configureState: (state: T) => T) => Promise<T>;
  /**
   * Updates backing stores for the given userId, which may or may not be active.
   * @param userId the UserId to target the update for
   * @param configureState function that takes the current state for the targeted user and returns the new state
   * @returns The new state
   */
  readonly updateFor: (userId: UserId, configureState: (state: T) => T) => Promise<T>;

  /**
   * Creates a derives state from the current state. Derived states are always tied to the active user.
   * @param derivedStateDefinition
   * @returns
   */
  createDerived: <TTo>(
    derivedStateDefinition: DerivedStateDefinition<T, TTo>
  ) => DerivedUserState<T, TTo>;
}
