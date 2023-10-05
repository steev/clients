import { Component } from "@angular/core";
import { ActivatedRoute, Params, Router } from "@angular/router";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { BaseAcceptComponent } from "../../common/base.accept.component";
import { StateService } from "../../core";
import { I18nService } from "../../core/i18n.service";
import { EmergencyAccessService } from "../core/services/emergency-access/emergency-access.service";

@Component({
  standalone: true,
  templateUrl: "accept-emergency.component.html",
})
export class AcceptEmergencyComponent extends BaseAcceptComponent {
  name: string;

  protected requiredParameters: string[] = ["id", "name", "email", "token"];
  protected failedShortMessage = "emergencyInviteAcceptFailedShort";
  protected failedMessage = "emergencyInviteAcceptFailed";

  constructor(
    router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    route: ActivatedRoute,
    stateService: StateService,
    private emergencyAccessService: EmergencyAccessService
  ) {
    super(router, platformUtilsService, i18nService, route, stateService);
  }

  async authedHandler(qParams: Params): Promise<void> {
    this.actionPromise = this.emergencyAccessService.accept(qParams.id, qParams.token);
    await this.actionPromise;
    await this.stateService.setEmergencyAccessInvitation(null);
    this.platformUtilService.showToast(
      "success",
      this.i18nService.t("inviteAccepted"),
      this.i18nService.t("emergencyInviteAcceptedDesc"),
      { timeout: 10000 }
    );
    this.router.navigate(["/vault"]);
  }

  async unauthedHandler(qParams: Params): Promise<void> {
    this.name = qParams.name;
    if (this.name != null) {
      // Fix URL encoding of space issue with Angular
      this.name = this.name.replace(/\+/g, " ");
    }

    // save the invitation to state so sso logins can find it later
    await this.stateService.setEmergencyAccessInvitation(qParams);
  }
}
