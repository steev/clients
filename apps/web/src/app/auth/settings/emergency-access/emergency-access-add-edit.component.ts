import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { EmergencyAccessType } from "@bitwarden/common/auth/enums/emergency-access-type";
import { EmergencyAccessInviteRequest } from "@bitwarden/common/auth/models/request/emergency-access-invite.request";
import { EmergencyAccessUpdateRequest } from "@bitwarden/common/auth/models/request/emergency-access-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { EmergencyAccessApiService } from "../../core/services/emergency-access/emergency-access-api.service";

@Component({
  selector: "emergency-access-add-edit",
  templateUrl: "emergency-access-add-edit.component.html",
})
export class EmergencyAccessAddEditComponent implements OnInit {
  @Input() name: string;
  @Input() emergencyAccessId: string;
  @Output() onSaved = new EventEmitter();
  @Output() onDeleted = new EventEmitter();

  loading = true;
  readOnly = false;
  editMode = false;
  title: string;
  email: string;
  type: EmergencyAccessType = EmergencyAccessType.View;

  formPromise: Promise<any>;

  emergencyAccessType = EmergencyAccessType;
  waitTimes: { name: string; value: number }[];
  waitTime: number;

  constructor(
    private emergencyAccessApiService: EmergencyAccessApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService
  ) {}

  async ngOnInit() {
    this.editMode = this.loading = this.emergencyAccessId != null;

    this.waitTimes = [
      { name: this.i18nService.t("oneDay"), value: 1 },
      { name: this.i18nService.t("days", "2"), value: 2 },
      { name: this.i18nService.t("days", "7"), value: 7 },
      { name: this.i18nService.t("days", "14"), value: 14 },
      { name: this.i18nService.t("days", "30"), value: 30 },
      { name: this.i18nService.t("days", "90"), value: 90 },
    ];

    if (this.editMode) {
      this.editMode = true;
      this.title = this.i18nService.t("editEmergencyContact");
      try {
        const emergencyAccess = await this.emergencyAccessApiService.getEmergencyAccess(
          this.emergencyAccessId
        );
        this.type = emergencyAccess.type;
        this.waitTime = emergencyAccess.waitTimeDays;
      } catch (e) {
        this.logService.error(e);
      }
    } else {
      this.title = this.i18nService.t("inviteEmergencyContact");
      this.waitTime = this.waitTimes[2].value;
    }

    this.loading = false;
  }

  async submit() {
    try {
      if (this.editMode) {
        const request = new EmergencyAccessUpdateRequest();
        request.type = this.type;
        request.waitTimeDays = this.waitTime;

        this.formPromise = this.emergencyAccessApiService.putEmergencyAccess(
          this.emergencyAccessId,
          request
        );
      } else {
        const request = new EmergencyAccessInviteRequest();
        request.email = this.email.trim();
        request.type = this.type;
        request.waitTimeDays = this.waitTime;

        this.formPromise = this.emergencyAccessApiService.postEmergencyAccessInvite(request);
      }

      await this.formPromise;
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t(this.editMode ? "editedUserId" : "invitedUsers", this.name)
      );
      this.onSaved.emit();
    } catch (e) {
      this.logService.error(e);
    }
  }

  async delete() {
    this.onDeleted.emit();
  }
}
