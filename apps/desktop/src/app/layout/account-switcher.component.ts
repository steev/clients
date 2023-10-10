import { animate, state, style, transition, trigger } from "@angular/animations";
import { ConnectedPosition } from "@angular/cdk/overlay";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { concatMap, Subject, takeUntil } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { EnvironmentUrls } from "@bitwarden/common/auth/models/domain/environment-urls";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Account } from "@bitwarden/common/platform/models/domain/account";

type ActiveAccount = {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  server: string;
};

type InactiveAccount = {
  id: string;
  name: string;
  email: string;
  authenticationStatus: AuthenticationStatus;
  avatarColor?: string;
  server?: string;
  environmentUrls?: EnvironmentUrls;
};

// export class SwitcherAccount extends Account {
//   get serverUrl() {
//     return this.removeWebProtocolFromString(
//       this.settings?.environmentUrls?.base ??
//         this.settings?.environmentUrls.api ??
//         this.settings.region
//     );
//   }

//   avatarColor: string;

//   private removeWebProtocolFromString(urlString: string) {
//     const regex = /http(s)?(:)?(\/\/)?|(\/\/)?(www\.)?/g;
//     return urlString.replace(regex, "");
//   }
// }

@Component({
  selector: "app-account-switcher",
  templateUrl: "account-switcher.component.html",
  animations: [
    trigger("transformPanel", [
      state(
        "void",
        style({
          opacity: 0,
        })
      ),
      transition(
        "void => open",
        animate(
          "100ms linear",
          style({
            opacity: 1,
          })
        )
      ),
      transition("* => void", animate("100ms linear", style({ opacity: 0 }))),
    ]),
  ],
})
export class AccountSwitcherComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isOpen = false;
  inactiveAccounts: { [userId: string]: InactiveAccount } = {};
  activeAccount?: ActiveAccount;
  serverUrl: string;
  authStatus = AuthenticationStatus;
  overlayPosition: ConnectedPosition[] = [
    {
      originX: "end",
      originY: "bottom",
      overlayX: "end",
      overlayY: "top",
    },
  ];

  get showSwitcher() {
    const userIsInAVault = !Utils.isNullOrWhitespace(this.activeAccount?.email);
    const userIsAddingAnAdditionalAccount = Object.keys(this.inactiveAccounts).length > 0;
    return userIsInAVault || userIsAddingAnAdditionalAccount;
  }

  get numberOfAccounts() {
    if (this.inactiveAccounts == null) {
      this.isOpen = false;
      return 0;
    }
    return Object.keys(this.inactiveAccounts).length;
  }

  constructor(
    private stateService: StateService,
    private authService: AuthService,
    private messagingService: MessagingService,
    private router: Router,
    private tokenService: TokenService,
    private environmentService: EnvironmentService
  ) {}

  async ngOnInit(): Promise<void> {
    this.stateService.accounts$
      .pipe(
        concatMap(async (accounts: { [userId: string]: Account }) => {
          // for (const userId in accounts) {
          //   accounts[userId].profile.authenticationStatus = await this.authService.getAuthStatus(
          //     userId
          //   );
          // }

          this.inactiveAccounts = await this.createInactiveAccounts(accounts);

          try {
            this.activeAccount = {
              id: await this.tokenService.getUserId(),
              name: (await this.tokenService.getName()) ?? (await this.tokenService.getEmail()),
              email: await this.tokenService.getEmail(),
              avatarColor: await this.stateService.getAvatarColor(),
              server: Utils.removeVaultfromHostname(
                Utils.getHostname(this.environmentService.getWebVaultUrl())
              ),
            };
          } catch {
            this.activeAccount = undefined;
          }

          // console.log("this.inactiveAccounts");
          // console.log(this.inactiveAccounts);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  async switch(userId: string) {
    this.close();

    this.messagingService.send("switchAccount", { userId: userId });
  }

  async addAccount() {
    this.close();
    await this.stateService.setActiveUser(null);
    await this.stateService.setRememberedEmail(null);
    this.router.navigate(["/login"]);
  }

  private async createInactiveAccounts(baseAccounts: {
    [userId: string]: Account;
  }): Promise<{ [userId: string]: InactiveAccount }> {
    const inactiveAccounts: { [userId: string]: InactiveAccount } = {};

    for (const userId in baseAccounts) {
      if (userId == null || userId === (await this.stateService.getUserId())) {
        continue;
      }

      inactiveAccounts[userId] = {
        id: userId,
        name: baseAccounts[userId].profile.name,
        email: baseAccounts[userId].profile.email,
        authenticationStatus: await this.authService.getAuthStatus(userId),
        avatarColor: await this.stateService.getAvatarColor({ userId: userId }),
        server: (await this.stateService.getServerConfig({ userId: userId })).environment.vault,
        /**
         * environmentUrls are stored on disk and must be retrieved separately from the
         * in memory state offered from subscribing to accounts
         */
        environmentUrls: await this.stateService.getEnvironmentUrls({ userId: userId }),
      };
    }

    return inactiveAccounts;
  }
}
