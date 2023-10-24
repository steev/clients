import { Opaque } from "type-fest";

import { UserId } from "../../types/guid";
import { KeyDefinition } from "../state/key-definition";

import { Utils } from "./utils";

export type StorageKey = Opaque<string, "StorageKey">;

export function userKeyBuilder(userId: UserId, keyDefinition: KeyDefinition<unknown>): StorageKey {
  if (!Utils.isGuid(userId)) {
    throw new Error("You cannot build a user key without a valid UserId");
  }
  return `user_${userId}_${keyDefinition.stateDefinition.name}_${keyDefinition.key}` as StorageKey;
}

export function globalKeyBuilder(keyDefinition: KeyDefinition<unknown>): StorageKey {
  return `global_${keyDefinition.stateDefinition.name}_${keyDefinition.key}` as StorageKey;
}
