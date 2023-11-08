import { from, Observable } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "../../../platform/abstractions/config/config.service.abstraction";
import { LogService } from "../../../platform/abstractions/log.service";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { AuthService } from "../../abstractions/auth.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "../../abstractions/webauthn/webauthn-login.service.abstraction";
import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginCredentials } from "../../models/domain/login-credentials";
import { WebAuthnLoginCredentialAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion.view";
import { createSymmetricKeyFromPrf, getLoginWithPrfSalt } from "../../utils/webauthn-utils";

import { WebAuthnLoginAssertionResponseRequest } from "./request/webauthn-login-assertion-response.request";

export class WebAuthnLoginService implements WebAuthnLoginServiceAbstraction {
  readonly enabled$: Observable<boolean>;

  constructor(
    private webAuthnLoginApiService: WebAuthnLoginApiServiceAbstraction,
    private authService: AuthService,
    private configService: ConfigServiceAbstraction,
    private navigatorCredentials: CredentialsContainer,
    private logService?: LogService
  ) {
    this.enabled$ = from(this.configService.getFeatureFlag$(FeatureFlag.PasswordlessLogin, false));
  }

  async getCredentialAssertionOptions(): Promise<WebAuthnLoginCredentialAssertionOptionsView> {
    const response = await this.webAuthnLoginApiService.getCredentialAssertionOptions();
    return new WebAuthnLoginCredentialAssertionOptionsView(response.options, response.token);
  }

  async assertCredential(
    credentialAssertionOptions: WebAuthnLoginCredentialAssertionOptionsView
  ): Promise<WebAuthnLoginCredentialAssertionView> {
    const nativeOptions: CredentialRequestOptions = {
      publicKey: credentialAssertionOptions.options,
    };
    // TODO: Remove `any` when typescript typings add support for PRF
    nativeOptions.publicKey.extensions = {
      prf: { eval: { first: await getLoginWithPrfSalt() } },
    } as any;

    try {
      const response = await this.navigatorCredentials.get(nativeOptions);
      if (!(response instanceof PublicKeyCredential)) {
        return undefined;
      }
      // TODO: Remove `any` when typescript typings add support for PRF
      const prfResult = (response.getClientExtensionResults() as any).prf?.results?.first;
      let symmetricPrfKey: SymmetricCryptoKey | undefined;
      if (prfResult != undefined) {
        symmetricPrfKey = createSymmetricKeyFromPrf(prfResult);
      }

      const deviceResponse = new WebAuthnLoginAssertionResponseRequest(response);

      // Verify that we aren't going to send PRF information to the server in any case.
      // Note: this will only happen if a dev has done something wrong.
      if ("prf" in deviceResponse.extensions) {
        throw new Error("PRF information is not allowed to be sent to the server.");
      }

      return new WebAuthnLoginCredentialAssertionView(
        credentialAssertionOptions.token,
        deviceResponse,
        symmetricPrfKey
      );
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  async logIn(assertion: WebAuthnLoginCredentialAssertionView): Promise<AuthResult> {
    const credential = new WebAuthnLoginCredentials(
      assertion.token,
      assertion.deviceResponse,
      assertion.prfKey
    );
    const result = await this.authService.logIn(credential);
    return result;
  }
}
