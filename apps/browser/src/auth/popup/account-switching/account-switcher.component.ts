import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DialogService } from "@bitwarden/components";

import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  templateUrl: "account-switcher.component.html",
})
export class AccountSwitcherComponent {
  constructor(
    private accountSwitcherService: AccountSwitcherService,
    private vaultTimeoutService: VaultTimeoutService,
    public messagingService: MessagingService,
    private dialogService: DialogService,
    private location: Location,
    private router: Router
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

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      type: "info",
    });

    if (confirmed) {
      this.messagingService.send("logout");
    }

    this.router.navigate(["account-switcher"]);
  }

  back() {
    this.location.back();
  }
}
