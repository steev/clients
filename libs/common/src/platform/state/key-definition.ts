import { Jsonify } from "type-fest";

import { DeriveContext, DerivedStateDefinition } from "./derived-state-definition";
import { StateDefinition } from "./state-definition";

/**
 * KeyDefinitions describe the precise location to store data for a given piece of state.
 * The StateDefinition is used to describe the domain of the state, and the KeyDefinition
 * sub-divides that domain into specific keys.
 */
export class KeyDefinition<T> {
  /**
   * Creates a new instance of a KeyDefinition
   * @param stateDefinition The state definition for which this key belongs to.
   * @param key The name of the key, this should be unique per domain
   * @param deserializer A function to use to safely convert your type from json to your expected type.
   */
  constructor(
    readonly stateDefinition: StateDefinition,
    readonly key: string,
    readonly deserializer: (jsonValue: Jsonify<T>) => T
  ) {}

  static array<T>(
    stateDefinition: StateDefinition,
    key: string,
    deserializer: (jsonValue: Jsonify<T>) => T
  ) {
    return new KeyDefinition<T[]>(stateDefinition, key, (jsonValue) => {
      // TODO: Should we handle null for them, I feel like we should discourage null for an array?
      return jsonValue.map((v) => deserializer(v));
    });
  }

  static record<T>(
    stateDefinition: StateDefinition,
    key: string,
    deserializer: (jsonValue: Jsonify<T>) => T
  ) {
    return new KeyDefinition<Record<string, T>>(stateDefinition, key, (jsonValue) => {
      const output: Record<string, T> = {};
      for (const key in jsonValue) {
        output[key] = deserializer((jsonValue as Record<string, Jsonify<T>>)[key]);
      }
      return output;
    });
  }

  /**
   * Helper for defining a derived definition that will often be used alongside a given key
   * @param keyDefinition The key definition detailing storage details for the derived state
   * @param deriveCallback The callback used to convert from the parent state to the derived state
   * @returns
   */
  createDerivedDefinition<TTo>(
    keyDefinition: KeyDefinition<TTo>,
    deriveCallback: (data: T, context: DeriveContext) => Promise<TTo>
  ) {
    return new DerivedStateDefinition(keyDefinition, deriveCallback);
  }
}
