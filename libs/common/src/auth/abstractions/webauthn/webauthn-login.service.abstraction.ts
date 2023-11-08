import { Observable } from "rxjs";

import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginCredentialAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion.view";

export abstract class WebAuthnLoginServiceAbstraction {
  /**
   * An Observable that emits a boolean indicating whether the WebAuthn login feature is enabled.
   */
  readonly enabled$: Observable<boolean>;

  /**
   * Gets the credential assertion options needed for initiating the WebAuthn
   * authentication process. It should provide the challenge and other data
   * (whether user verification is required, the relying party id, timeout duration for the process to complete, etc.)
   * for the authenticator.
   */
  getCredentialAssertionOptions: () => Promise<
    WebAuthnLoginCredentialAssertionOptionsView | undefined
  >;

  /**
   * Asserts the credential. This involves user interaction with the authenticator
   * to sign a challenge with a private key (proving ownership of the private key).
   *
   * @param {WebAuthnLoginCredentialAssertionOptionsView} credentialAssertionOptions - The options provided by the
   * getCredentialAssertionOptions method, including the challenge and other data.
   */
  assertCredential: (
    credentialAssertionOptions: WebAuthnLoginCredentialAssertionOptionsView
  ) => Promise<WebAuthnLoginCredentialAssertionView | undefined>;

  /**
   * Logs the user in using the assertion obtained from the authenticator.
   * It completes the authentication process if the assertion is successfully validated server side:
   * the server verifies the signed challenge with the corresponding public key.
   *
   * @param {WebAuthnLoginCredentialAssertionView} assertion - The assertion obtained from the authenticator
   * that needs to be validated for login.
   */
  logIn: (assertion: WebAuthnLoginCredentialAssertionView) => Promise<AuthResult>;
}
