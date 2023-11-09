import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey, PrfKey } from "../../platform/models/domain/symmetric-crypto-key";

const LoginWithPrfSalt = "passwordless-login";

export async function getLoginWithPrfSalt(): Promise<ArrayBuffer> {
  return await crypto.subtle.digest("sha-256", Utils.fromUtf8ToArray(LoginWithPrfSalt));
}

export function createSymmetricKeyFromPrf(prf: ArrayBuffer): PrfKey {
  return new SymmetricCryptoKey(new Uint8Array(prf)) as PrfKey;
}
