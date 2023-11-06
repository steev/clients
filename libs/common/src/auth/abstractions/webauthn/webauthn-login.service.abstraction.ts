import { Observable } from "rxjs";

import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-assertion-options.view";
import { WebAuthnLoginAssertionView } from "../../models/view/webauthn-login/webauthn-login-assertion.view";

export abstract class WebAuthnLoginServiceAbstraction {
  readonly enabled$: Observable<boolean>;

  getCredentialAssertionOptions: () => Promise<WebAuthnLoginAssertionOptionsView | undefined>;
  assertCredential: (
    credentialOptions: WebAuthnLoginAssertionOptionsView
  ) => Promise<WebAuthnLoginAssertionView | undefined>;
  logIn: (assertion: WebAuthnLoginAssertionView) => Promise<AuthResult>;
}
