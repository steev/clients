import { Component } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Router, provideRouter } from "@angular/router";
import { RouterTestingHarness } from "@angular/router/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { RouterService } from "../router.service";

import { deepLinkRedirectGuard } from "./deep-link-redirect.guard";

@Component({
  template: "",
})
export class GuardedRouteTestComponent {}

@Component({
  template: "",
})
export class RedirectTestComponent {}

/**
 * We are assuming the guard is always being called. We are creating routes
 */
describe("Deep Link Cache Guard", () => {
  let routerService: MockProxy<RouterService>;
  let routerHarness: RouterTestingHarness;

  beforeEach(async () => {
    routerService = mock<RouterService>();
    TestBed.configureTestingModule({
      providers: [
        { provide: RouterService, useValue: routerService },
        provideRouter([
          {
            path: "guarded-route",
            component: GuardedRouteTestComponent,
            canActivate: [deepLinkRedirectGuard()],
          },
          {
            path: "redirect-route",
            component: RedirectTestComponent,
          },
        ]),
      ],
    });

    routerHarness = await RouterTestingHarness.create();
  });

  // Story: User is redirected
  it("should redirect user", async () => {
    // Arrange
    routerService.getAndClearLoginRedirectUrl.mockResolvedValue("/redirect-route");

    // Act
    await routerHarness.navigateByUrl("/guarded-route");

    // Assert
    expect(TestBed.inject(Router).url).toEqual("/redirect-route");
  });

  // Story: User is not redirected
  it("should not redirect user", async () => {
    // Arrange
    routerService.getAndClearLoginRedirectUrl.mockResolvedValue("");

    // Act
    await routerHarness.navigateByUrl("/guarded-route");

    // Assert
    expect(TestBed.inject(Router).url).toEqual("/guarded-route");
  });
});
