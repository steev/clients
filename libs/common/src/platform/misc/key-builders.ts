import { Opaque } from "type-fest";

import { UserId } from "../../types/guid";
import { KeyDefinition } from "../state/key-definition";

export type StorageKey = Opaque<string, "StorageKey">;

export function userKeyBuilder(userId: UserId, keyDefinition: KeyDefinition<unknown>): StorageKey {
  if (userId == null) {
    throw new Error("You cannot build a user key without");
  }
  return `${keyDefinition.stateDefinition.name}_${userId}_${keyDefinition.key}` as StorageKey;
}

export function globalKeyBuilder(keyDefinition: KeyDefinition<unknown>): StorageKey {
  return `${keyDefinition.stateDefinition.name}_global_${keyDefinition.key}` as StorageKey;
}
