import { Utils } from "../../../../platform/misc/utils";

import { WebAuthnLoginResponseRequest } from "./webauthn-login-response.request";

export class WebAuthnLoginAssertionResponseRequest extends WebAuthnLoginResponseRequest {
  response: {
    authenticatorData: string;
    signature: string;
    clientDataJSON: string;
    userHandle: string;
  };

  constructor(credential: PublicKeyCredential) {
    super(credential);

    if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
      throw new Error("Invalid authenticator response");
    }

    this.response = {
      authenticatorData: Utils.fromBufferToB64(credential.response.authenticatorData),
      signature: Utils.fromBufferToB64(credential.response.signature),
      clientDataJSON: Utils.fromBufferToB64(credential.response.clientDataJSON),
      userHandle: Utils.fromBufferToB64(credential.response.userHandle),
    };
  }
}
