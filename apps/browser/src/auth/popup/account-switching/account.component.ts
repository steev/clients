import { Component, Input } from "@angular/core";
import { Router } from "@angular/router";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
// import { I18nService } from "@bitwarden/common/platform/services/i18n.service";

import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  selector: "auth-account",
  templateUrl: "account.component.html",
})
export class AccountComponent {
  // TODO: replace use of 'any'
  @Input() account: any;

  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private router: Router,
    private i18nService: I18nService
  ) {}

  get specialAccountAddId() {
    return this.accountSwitcherService.SPECIAL_ADD_ACCOUNT_ID;
  }

  async selectAccount(id: string) {
    await this.accountSwitcherService.selectAccount(id);
    this.router.navigate(["/home"]);
  }

  get status() {
    if (this.account.isSelected) {
      return { text: this.i18nService.t("active"), icon: "bwi-check-circle" };
    }

    if (this.account.status === AuthenticationStatus.Unlocked) {
      return { text: this.i18nService.t("unlocked"), icon: "bwi-unlock" };
    }

    return { text: this.i18nService.t("locked"), icon: "bwi-lock" };
  }
}
