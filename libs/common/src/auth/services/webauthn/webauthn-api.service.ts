import { ApiService } from "../../../abstractions/api.service";
import { EnvironmentService } from "../../../platform/abstractions/environment.service";
import { WebauthnApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-api.service.abstraction";

import { CredentialAssertionOptionsResponse } from "./responses/credential-assertion-options.response";

export class WebauthnApiService implements WebauthnApiServiceAbstraction {
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
