import { Utils } from "../../../../platform/misc/utils";

import { WebAuthnLoginResponseRequest } from "./webauthn-login-response.request";

// base 64 strings
export interface WebAuthnLoginAssertionResponseData {
  authenticatorData: string;
  signature: string;
  clientDataJSON: string;
  userHandle: string;
}

export class WebAuthnLoginAssertionResponseRequest extends WebAuthnLoginResponseRequest {
  response: WebAuthnLoginAssertionResponseData;

  constructor(credential: PublicKeyCredential) {
    super(credential);

    if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
      throw new Error("Invalid authenticator response");
    }

    this.response = {
      authenticatorData: Utils.fromBufferToUrlB64(credential.response.authenticatorData),
      signature: Utils.fromBufferToUrlB64(credential.response.signature),
      clientDataJSON: Utils.fromBufferToUrlB64(credential.response.clientDataJSON),
      userHandle: Utils.fromBufferToUrlB64(credential.response.userHandle),
    };
  }
}
