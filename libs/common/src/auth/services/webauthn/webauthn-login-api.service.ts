import { ApiService } from "../../../abstractions/api.service";
import { EnvironmentService } from "../../../platform/abstractions/environment.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";

import { CredentialAssertionOptionsResponse } from "./response/credential-assertion-options.response";

export class WebAuthnLoginApiService implements WebAuthnLoginApiServiceAbstraction {
  constructor(private apiService: ApiService, private environmentService: EnvironmentService) {}

  async getCredentialAssertionOptions(email?: string): Promise<CredentialAssertionOptionsResponse> {
    const response = await this.apiService.send(
      "POST",
      `/accounts/webauthn-assertion-options`,
      { email: email ?? null },
      false,
      true,
      this.environmentService.getIdentityUrl()
    );
    return new CredentialAssertionOptionsResponse(response);
  }
}
