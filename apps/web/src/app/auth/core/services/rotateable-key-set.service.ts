import { inject, Injectable } from "@angular/core";

import { RotateableKeySet } from "@bitwarden/auth";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

@Injectable({ providedIn: "root" })
export class RotateableKeySetService {
  private readonly cryptoService = inject(CryptoService);
  private readonly encryptService = inject(EncryptService);

  async createKeySet<ExternalKey extends SymmetricCryptoKey>(
    externalKey: ExternalKey
  ): Promise<RotateableKeySet<ExternalKey>> {
    const [publicKey, encryptedPrivateKey] = await this.cryptoService.makeKeyPair(externalKey);

    const userKey = await this.cryptoService.getUserKey();
    const rawPublicKey = Utils.fromB64ToArray(publicKey);
    const encryptedUserKey = await this.cryptoService.rsaEncrypt(userKey.key, rawPublicKey);
    const encryptedPublicKey = await this.encryptService.encrypt(rawPublicKey, userKey);
    return new RotateableKeySet(encryptedUserKey, encryptedPublicKey, encryptedPrivateKey);
  }
}
