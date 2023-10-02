import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { RouterService } from "../../core/router.service";

import { deepLinkCacheGuard } from "./deep-link-cache.guard";

@Component({
  template: "",
})
export class GuardedRouteTestComponent {}

@Component({
  template: "",
})
export class LockTestComponent {}

/**
 * We are assuming the guard is always being called. We are creating routes using the
 * RouterTestingHarness.
 *
 * when persisting a URL to storage we don't care wether or not the user is locked or logged out.
 * We only care about where the user is going, and has been.
 *
 * We don't need to test which component is activated because we are only testing
 * weather or not the guard is calling the routerService.persistLoginRedirectUrl().
 */
describe("Deep Link Cache Guard", () => {
  let authService: MockProxy<AuthService>;
  let routerService: MockProxy<RouterService>;
  let routerHarness: RouterTestingHarness;

  beforeEach(async () => {
    authService = mock<AuthService>();
    routerService = mock<RouterService>();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: RouterService, useValue: routerService },
        provideRouter([
          {
            path: "guarded-route",
            component: GuardedRouteTestComponent,
            canActivate: [deepLinkCacheGuard()],
          },
          {
            path: "lock-route",
            component: LockTestComponent,
            canActivate: [deepLinkCacheGuard()],
          },
        ]),
      ],
    });

    routerHarness = await RouterTestingHarness.create();
  });

  // Story: User's vault times out
  it('should persist routerService.previousUrl when routerService.previousUrl does not contain "lock"', async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    routerService.getPreviousUrl.mockReturnValue("/previous-url");

    // Act
    await routerHarness.navigateByUrl("/lock-route");

    // Assert
    expect(routerService.persistLoginRedirectUrl).toHaveBeenCalledWith("/previous-url");
  });

  // Story: User's vault times out and previousUrl contains "lock"
  it('should not persist routerService.previousUrl when routerService.previousUrl contains "lock"', async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    routerService.getPreviousUrl.mockReturnValue("/lock");

    // Act
    await routerHarness.navigateByUrl("/lock-route");

    // Assert
    expect(routerService.persistLoginRedirectUrl).not.toHaveBeenCalled();
  });

  // Story: User's vault times out and previousUrl is undefined
  it("should not persist routerService.previousUrl when routerService.previousUrl is undefined", async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    routerService.getPreviousUrl.mockReturnValue(undefined);

    // Act
    await routerHarness.navigateByUrl("/lock-route");

    // Assert
    expect(routerService.persistLoginRedirectUrl).not.toHaveBeenCalled();
  });

  // Story: User tries to deep link to a guarded route and is logged out
  it('should persist currentUrl when currentUrl does not contain "lock"', async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

    // Act
    await routerHarness.navigateByUrl("/guarded-route?item=123");

    // Assert
    expect(routerService.persistLoginRedirectUrl).toHaveBeenCalledWith("/guarded-route?item=123");
  });

  // Story: User tries to deep link to "lock"
  it('should not persist currentUrl if the currentUrl contains "lock"', async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.LoggedOut);

    // Act
    await routerHarness.navigateByUrl("/lock-route");

    // Assert
    expect(routerService.persistLoginRedirectUrl).not.toHaveBeenCalled();
  });

  // Story: User tries to deep link to a guarded route from the lock page
  it("should persist currentUrl over previousUrl", async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Locked);
    routerService.getPreviousUrl.mockReturnValue("/previous-url");

    // Act
    await routerHarness.navigateByUrl("/guarded-route?item=123");

    // Assert
    expect(routerService.persistLoginRedirectUrl).toHaveBeenCalledWith("/guarded-route?item=123");
  });

  // Story: user tries to deep link and is unlocked
  it("should not persist any URL if the user is unlocked", async () => {
    // Arrange
    authService.getAuthStatus.mockResolvedValue(AuthenticationStatus.Unlocked);

    // Act
    await routerHarness.navigateByUrl("/guarded-route");

    // Assert
    expect(routerService.persistLoginRedirectUrl).not.toHaveBeenCalled();
  });
});
