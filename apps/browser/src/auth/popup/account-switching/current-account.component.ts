import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

@Component({
  selector: "app-current-account",
  templateUrl: "current-account.component.html",
})
export class CurrentAccountComponent {
  constructor(
    private accountService: AccountService,
    private router: Router,
    private location: Location,
    private route: ActivatedRoute
  ) {}

  get currentAccount$() {
    return this.accountService.activeAccount$;
  }

  get currentAccountName$() {
    return this.currentAccount$.pipe(
      map((a) => {
        return Utils.isNullOrWhitespace(a.name) ? a.email : a.name;
      })
    );
  }

  async currentAccountClicked() {
    if (this.route.snapshot.data.state.includes("account-switcher")) {
      this.location.back();
    } else {
      this.router.navigate(["/account-switcher"]);
    }
  }
}
