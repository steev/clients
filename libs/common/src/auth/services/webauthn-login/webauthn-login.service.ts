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
import { WebAuthnLoginAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-assertion-options.view";
import { WebAuthnLoginAssertionView } from "../../models/view/webauthn-login/webauthn-login-assertion.view";
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

  // Get me all the options I need to send to the hardware key to authenticate
  // server provides a challenge and what types of credentials we (the relying party - BW) support
  async getCredentialAssertionOptions(): Promise<WebAuthnLoginAssertionOptionsView> {
    const response = await this.webAuthnLoginApiService.getCredentialAssertionOptions();
    return new WebAuthnLoginAssertionOptionsView(response.options, response.token);
  }

  // Assertion interacts w/ authenticator
  // Take this challenge and sign this with the private key that you should have
  // Server could accept the signed challenge and verify it using the public key that it has
  // We've basically moved this assertion validation into the identity service
  // so when you call login if it can be validated, it will and you can be authenticated.
  async assertCredential(
    credentialOptions: WebAuthnLoginAssertionOptionsView
  ): Promise<WebAuthnLoginAssertionView> {
    const nativeOptions: CredentialRequestOptions = {
      publicKey: credentialOptions.options,
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

      return new WebAuthnLoginAssertionView(
        credentialOptions.token,
        deviceResponse,
        symmetricPrfKey
      );
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  async logIn(assertion: WebAuthnLoginAssertionView): Promise<AuthResult> {
    const credential = new WebAuthnLoginCredentials(
      assertion.token,
      assertion.deviceResponse,
      assertion.prfKey
    );
    const result = await this.authService.logIn(credential);
    return result;
  }
}
