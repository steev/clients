import { Component, Input } from "@angular/core";
import { Router } from "@angular/router";

import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  selector: "auth-account",
  templateUrl: "account.component.html",
})
export class AccountComponent {
  // TODO: replace use of 'any'
  @Input() account: any;

  constructor(private accountSwitcherService: AccountSwitcherService, private router: Router) {}

  get specialAccountAddId() {
    return this.accountSwitcherService.SPECIAL_ADD_ACCOUNT_ID;
  }

  async selectAccount(id: string) {
    await this.accountSwitcherService.selectAccount(id);
    this.router.navigate(["/home"]);
  }
}
