import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";

import { BrowserRouterService } from "../../../platform/popup/services/browser-router.service";
import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  templateUrl: "account-switcher.component.html",
})
export class AccountSwitcherComponent {
  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private vaultTimeoutService: VaultTimeoutService,
    private location: Location,
    private router: Router,
    private routerService: BrowserRouterService
  ) {}

  get accountLimit() {
    return this.accountSwitcherService.ACCOUNT_LIMIT;
  }

  get specialAddAccountId() {
    return this.accountSwitcherService.SPECIAL_ADD_ACCOUNT_ID;
  }

  get accountOptions$() {
    return this.accountSwitcherService.accountOptions$;
  }

  async lock() {
    await this.vaultTimeoutService.lock();
    this.router.navigate(["lock"]);
  }

  back() {
    this.location.back();
  }
}
