import { CredentialAssertionOptionsResponse } from "../../services/webauthn-login/response/credential-assertion-options.response";

export class WebAuthnLoginApiServiceAbstraction {
  getCredentialAssertionOptions: (email?: string) => Promise<CredentialAssertionOptionsResponse>;
}
