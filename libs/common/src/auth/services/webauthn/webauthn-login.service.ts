import { from, Observable } from "rxjs";

import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "../../../platform/abstractions/config/config.service.abstraction";
// import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { AuthService } from "../../abstractions/auth.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "../../abstractions/webauthn/webauthn-login.service.abstraction";
// import { AuthResult } from "../../models/domain/auth-result";
// import { WebAuthnLoginCredentials } from "../../models/domain/login-credentials";
import { CredentialAssertionOptionsView } from "../../models/view/webauthn/credential-assertion-options.view";

// import { AuthenticatorAssertionResponseRequest } from "./request/authenticator-assertion-response.request";
// import { WebauthnAssertionResponseRequest } from "./request/webauthn-assertion-response.request";
// import { createSymmetricKeyFromPrf, getLoginWithPrfSalt } from "./utils";

// TODO: if we are renaming things from Webauthn to WebAuthn, should file name have dash between Web and Authn? prob not b/c then it's confusing web-authn vs webauthn
export class WebAuthnLoginService implements WebAuthnLoginServiceAbstraction {
  readonly enabled$: Observable<boolean>;

  constructor(
    private webAuthnLoginApiService: WebAuthnLoginApiServiceAbstraction,
    private authService: AuthService,
    private configService: ConfigServiceAbstraction
  ) {
    this.enabled$ = from(this.configService.getFeatureFlag$(FeatureFlag.PasswordlessLogin, false));
  }

  // Get me all the options I need to send to the hardware key to authenticate
  // server provides a challenge and what types of credentials we (the relying party - BW) support
  // optional email was for the non-discoverable flow (not supporting this anymore)
  async getCredentialAssertionOptions(): Promise<CredentialAssertionOptionsView> {
    const response = await this.webAuthnLoginApiService.getCredentialAssertionOptions();
    return new CredentialAssertionOptionsView(response.options, response.token);
  }

  // could have been named ValidateAssertedCredential
  // Assertion interacts w/ authenticator
  // Take this challenge and sign this with the private key that you should have
  // Server could accept the signed challenge and verify it using the public key that it has
  // We've basically moved this assertion validation into the identity service
  // so when you call login if it can be validated, it will and you can be authenticated.
  // async assertCredential(
  //   credentialOptions: CredentialAssertionOptionsView
  // ): Promise<WebauthnAssertionView> {
  //   const nativeOptions: CredentialRequestOptions = {
  //     publicKey: credentialOptions.options,
  //   };
  //   // TODO: Remove `any` when typescript typings add support for PRF
  //   nativeOptions.publicKey.extensions = {
  //     prf: { eval: { first: await getLoginWithPrfSalt() } },
  //   } as any;

  //   try {
  //     const response = await this.navigatorCredentials.get(nativeOptions);
  //     if (!(response instanceof PublicKeyCredential)) {
  //       return undefined;
  //     }
  //     // TODO: Remove `any` when typescript typings add support for PRF
  //     const prfResult = (response.getClientExtensionResults() as any).prf?.results?.first;
  //     let symmetricPrfKey: SymmetricCryptoKey | undefined;
  //     if (prfResult != undefined) {
  //       symmetricPrfKey = createSymmetricKeyFromPrf(prfResult);
  //     }

  //     const deviceResponse = new AuthenticatorAssertionResponseRequest(response);
  //     const request = new WebauthnAssertionResponseRequest(credentialOptions.token, deviceResponse);
  //     const token = await this.webAuthnApiService.assertCredential(request);

  //     return new WebauthnAssertionView(token, symmetricPrfKey);
  //   } catch (error) {
  //     this.logService?.error(error);
  //     return undefined;
  //   }
  // }

  // TODO: figure out what view input should look like
  // async logIn(assertion: WebauthnAssertionView): Promise<AuthResult> {
  //   const credential = new WebAuthnLoginCredentials(assertion.token, assertion.prfKey);
  //   const result = await this.authService.logIn(credential);
  //   return result;
  // }
}
