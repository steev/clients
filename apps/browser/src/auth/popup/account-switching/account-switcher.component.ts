import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { BrowserRouterService } from "../../../platform/popup/services/browser-router.service";
import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  templateUrl: "account-switcher.component.html",
})
export class AccountSwitcherComponent {
  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private router: Router,
    private routerService: BrowserRouterService,
    private location: Location
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

  async selectAccount(id: string) {
    await this.accountSwitcherService.selectAccount(id);
    this.router.navigate([this.routerService.getPreviousUrl() ?? "/home"]);
  }

  back() {
    this.location.back();
  }
}
