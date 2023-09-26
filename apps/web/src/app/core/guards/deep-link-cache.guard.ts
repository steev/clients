import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { RouterService } from "../router.service";

/**
 * Guard to persist deep-linking URL to state while user continues the login flow
 * @returns returns true, if user is not Unlocked will store URL to State
 */
export function deepLinkCacheGuard(): CanActivateFn {
  return async (route, routerState) => {
    const authService = inject(AuthService);
    const routerService = inject(RouterService);
    const authStatus = await authService.getAuthStatus();

    const currentUrl = routerState.url;
    const transientPreviousUrl = routerService.getPreviousUrl();
    if (
      authStatus === AuthenticationStatus.Locked &&
      transientPreviousUrl?.indexOf("lock") === -1
    ) {
      await routerService.persistLoginRedirectUrl(transientPreviousUrl);
    } else if (
      authStatus !== AuthenticationStatus.Unlocked &&
      !Utils.isNullOrEmpty(currentUrl) &&
      currentUrl?.indexOf("lock") === -1
    ) {
      await routerService.persistLoginRedirectUrl(currentUrl);
    }

    return true;
  };
}
