import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

export class PendingWebauthnLoginCryptoKeysView {
  constructor(
    readonly encryptedUserKey: EncString,
    readonly encryptedPublicKey: EncString,
    readonly encryptedPrivateKey: EncString
  ) {}
}
