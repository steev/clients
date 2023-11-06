import { WebAuthnLoginAssertionResponseRequest } from "../../../../auth/services/webauthn-login/request/webauthn-login-assertion-response.request";

import { DeviceRequest } from "./device.request";
import { TokenTwoFactorRequest } from "./token-two-factor.request";
import { TokenRequest } from "./token.request";

export class WebAuthnTokenRequest extends TokenRequest {
  constructor(
    public token: string,
    public deviceResponse: WebAuthnLoginAssertionResponseRequest,
    protected twoFactor: TokenTwoFactorRequest,
    device?: DeviceRequest
  ) {
    super(twoFactor, device);
  }

  toIdentityToken(clientId: string) {
    const obj = super.toIdentityToken(clientId);

    obj.grant_type = "webauthn";
    obj.token = this.token;

    return obj;
  }
}
