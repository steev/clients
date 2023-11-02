import { CredentialAssertionOptionsResponse } from "../../services/webauthn/response/credential-assertion-options.response";

export class WebauthnApiServiceAbstraction {
  getCredentialAssertionOptions: (email?: string) => Promise<CredentialAssertionOptionsResponse>;
}
