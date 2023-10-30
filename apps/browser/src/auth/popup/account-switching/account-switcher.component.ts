import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
// import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
// import { UserId } from "@bitwarden/common/types/guid";

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
    private accountService: AccountService
  ) {
    // this.accountService.addAccount("Mario" as UserId, {
    //   name: "Mario",
    //   email: "mario@test.com",
    //   status: AuthenticationStatus.Locked,
    // });
    // this.accountService.addAccount("Yoshi" as UserId, {
    //   name: "Yoshi",
    //   email: "yoshi@test.com",
    //   status: AuthenticationStatus.Locked,
    // });
    // this.accountService.switchAccount("Mario" as UserId);
  }

  get accountOptions$() {
    return this.accountSwitcherService.accountOptions$;
  }

  async selectAccount(id: string) {
    await this.accountSwitcherService.selectAccount(id);
    this.router.navigate([this.routerService.getPreviousUrl() ?? "/home"]);
  }
}
