import { Injectable } from "@angular/core";
import { combineLatest, map, tap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { UserId } from "@bitwarden/common/types/guid";

@Injectable({
  providedIn: "root",
})
export class AccountSwitcherService {
  ACCOUNT_LIMIT = 5;
  SPECIAL_ADD_ACCOUNT_ID = "addAccount";

  constructor(
    private accountService: AccountService,
    private stateService: StateService,
    private messagingService: MessagingService
  ) {}

  get accountOptions$() {
    return combineLatest([this.accountService.accounts$, this.accountService.activeAccount$]).pipe(
      tap((res) => {
        console.log("accounts ---");
        console.log(res);
      }),
      map(([accounts, activeAccount]) => {
        const accountEntries = Object.entries(accounts);
        console.log("accountEntries ---");
        console.log(accountEntries);
        // Accounts shouldn't ever be more than ACCOUNT_LIMIT but just in case do a greater than
        const hasMaxAccounts = accountEntries.length >= this.ACCOUNT_LIMIT;
        const options: { name: string; id: string; isSelected: boolean }[] = accountEntries.map(
          ([id, account]) => {
            return {
              name: account.name ?? account.email,
              id: id,
              status: account.status,
              isSelected: id === activeAccount?.id,
            };
          }
        );

        if (!hasMaxAccounts) {
          options.push({
            name: "Add Account",
            id: this.SPECIAL_ADD_ACCOUNT_ID,
            isSelected: activeAccount?.id == null,
          });
        }

        console.log("options ---");
        console.log(options);

        return options;
      })
    );
  }

  async selectAccount(id: string) {
    if (id === this.SPECIAL_ADD_ACCOUNT_ID) {
      await this.stateService.setActiveUser(null);
      await this.stateService.setRememberedEmail(null);
      return;
    }

    await this.accountService.switchAccount(id as UserId);
    this.messagingService.send("switchAccount", { userId: id });
  }
}
