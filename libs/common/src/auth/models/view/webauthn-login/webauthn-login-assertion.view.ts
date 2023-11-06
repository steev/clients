import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { WebAuthnLoginAssertionResponseRequest } from "../../../services/webauthn-login/request/webauthn-login-assertion-response.request";

export class WebAuthnLoginAssertionView {
  constructor(
    readonly token: string,
    readonly deviceResponse: WebAuthnLoginAssertionResponseRequest,
    readonly prfKey?: SymmetricCryptoKey
  ) {}
}
