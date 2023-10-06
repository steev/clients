import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  PrfKey,
  SymmetricCryptoKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

declare const tag: unique symbol;

/**
 * A set of keys where a UserKey is protected by an encrypted public/private key-pair.
 * The UserKey is used to encrypt/decrypt data, while the public/private key-pair is
 * used to rotate the UserKey.
 *
 * The private key is protected by an ExternalKey, such as a device key, or PRF key,
 * and the public key is protected by the UserKey. This allows rotation to a NewUserKey
 * by only knowing the current UserKey, without having access to the ExternalKey.
 */
export class RotateableKeySet<ExternalKey extends SymmetricCryptoKey = SymmetricCryptoKey> {
  private readonly [tag]: ExternalKey;

  constructor(
    /** PublicKey encrypted UserKey */
    readonly encryptedUserKey: EncString,

    /** UserKey encrypted PublicKey */
    readonly encryptedPublicKey: EncString,

    /** ExternalKey encrypted PrivateKey */
    readonly encryptedPrivateKey: EncString
  ) {}
}

export type PrfKeySet = RotateableKeySet<PrfKey>;
