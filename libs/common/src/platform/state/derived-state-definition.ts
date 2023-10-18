import { EncryptService } from "../abstractions/encrypt.service";
import { UserKey } from "../models/domain/symmetric-crypto-key";

import { KeyDefinition } from "./key-definition";

// TODO: Move type
export class DeriveContext {
  constructor(readonly activeUserKey: UserKey, readonly encryptService: EncryptService) {}
}

export class DerivedStateDefinition<TFrom, TTo> {
  constructor(
    readonly KeyDefinition: KeyDefinition<TTo>,
    readonly converter: (data: TFrom, context: DeriveContext) => Promise<TTo>
  ) {}
}
