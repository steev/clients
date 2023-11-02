import { CredentialAssertionOptionsResponse } from "../../services/webauthn/responses/credential-assertion-options.response";

export class WebauthnApiServiceAbstraction {
  getCredentialAssertionOptions: (email?: string) => Promise<CredentialAssertionOptionsResponse>;
}
