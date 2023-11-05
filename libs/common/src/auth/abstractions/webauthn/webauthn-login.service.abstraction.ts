import { Observable } from "rxjs";

// import { AuthResult } from "../../models/domain/auth-result";
import { CredentialAssertionOptionsView } from "../../models/view/webauthn/credential-assertion-options.view";

// TODO: if we are renaming things from Webauthn to WebAuthn, should file name have dash between Web and Authn?
export abstract class WebAuthnLoginServiceAbstraction {
  readonly enabled$: Observable<boolean>;

  getCredentialAssertionOptions: () => Promise<CredentialAssertionOptionsView | undefined>;

  // TODO: figure out what input view should be
  // logIn: (assertion: WebauthnAssertionView) => Promise<AuthResult>;
}
