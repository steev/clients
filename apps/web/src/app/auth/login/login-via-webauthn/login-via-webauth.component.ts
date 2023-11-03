import { Component } from "@angular/core";

import { BaseLoginViaWebAuthnComponent } from "@bitwarden/angular/src/auth/components/base-login-via-webauthn.component";
import { CreatePasskeyFailedIcon } from "@bitwarden/angular/src/auth/icons/create-passkey-failed.icon";
import { CreatePasskeyIcon } from "@bitwarden/angular/src/auth/icons/create-passkey.icon";

@Component({
  selector: "app-login-via-webauthn",
  templateUrl: "login-via-webauthn.component.html",
})
export class LoginViaWebAuthnComponent extends BaseLoginViaWebAuthnComponent {
  protected readonly Icons = { CreatePasskeyIcon, CreatePasskeyFailedIcon };
}
