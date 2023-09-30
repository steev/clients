import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { RouterService } from "../router.service";

/**
 * Guard to persist deep-linking URL to state while user continues the login flow
 * @returns returns true. If user is not Unlocked will store URL to state for redirect once
 * user is unlocked/Authenticated.
 */
export function deepLinkCacheGuard(): CanActivateFn {
  return async (route, routerState) => {
    // Inject Services
    const authService = inject(AuthService);
    const routerService = inject(RouterService);

    // Fetch State
    const currentUrl = routerState.url;
    const authStatus = await authService.getAuthStatus();
    const transientPreviousUrl = routerService.getPreviousUrl();

    // Evaluate State
    if (
      authStatus === AuthenticationStatus.Locked &&
      !Utils.isNullOrEmpty(transientPreviousUrl) &&
      transientPreviousUrl?.indexOf("lock") === -1
    ) {
      /**
       * We persist routerService.previousUrl because it is the most recent navigation at
       * the time a user was locked. This allows us to navigate to "/vault" after a user
       * unlocks and utilize the deepLinkRedirectGuard() to navigate back to where a user
       * was prior to being locked out.
       */
      await routerService.persistLoginRedirectUrl(transientPreviousUrl);
    } else if (
      authStatus === AuthenticationStatus.LoggedOut &&
      !Utils.isNullOrEmpty(currentUrl) &&
      currentUrl?.indexOf("lock") === -1
    ) {
      /**
       * We really only want to track the currentUrl if the user is logged out. If a user
       * is moved to the lock state and they are chillin' at the vault page we don't want
       * to add extra routing logic to just end up at the vault page anyway.
       */
      await routerService.persistLoginRedirectUrl(currentUrl);
    }
    return true;
  };
}
