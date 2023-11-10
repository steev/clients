import { Location } from "@angular/common";
import { Component } from "@angular/core";

import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  templateUrl: "account-switcher.component.html",
})
export class AccountSwitcherComponent {
  constructor(
    private accountSwitcherService: AccountSwitcherService,

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

  back() {
    this.location.back();
  }
}
