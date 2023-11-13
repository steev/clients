import { Location } from "@angular/common";
import { Component, OnDestroy } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, map, takeUntil } from "rxjs";

import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { DialogService } from "@bitwarden/components";

import { AccountSwitcherService } from "../services/account-switcher.service";

@Component({
  templateUrl: "account-switcher.component.html",
})
export class AccountSwitcherComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

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

  back() {
    this.location.back();
  }

  async lock(userId?: string) {
    await this.vaultTimeoutService.lock(userId ? userId : null);
    this.router.navigate(["lock"]);
  }

  async lockAll() {
    this.accountOptions$
      .pipe(
        map((accounts) =>
          accounts
            .filter((account) => account.id !== this.specialAddAccountId)
            .map((account) => account.id)
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((accountIds) => accountIds.forEach(async (id) => await this.lock(id)));
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
