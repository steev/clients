import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, Subject, switchMap, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";

import { AccessPolicySelectorService } from "../../shared/access-policies/access-policy-selector/access-policy-selector.service";
import {
  ApItemValueType,
  convertToProjectPeopleAccessPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-value.type";
import {
  ApItemViewType,
  convertToAccessPolicyItemViews,
} from "../../shared/access-policies/access-policy-selector/models/ap-item-view.type";
import { ApItemEnum } from "../../shared/access-policies/access-policy-selector/models/enums/ap-item.enum";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import { AccessSelectorComponent } from "../../shared/access-policies/access-selector.component";

@Component({
  selector: "sm-project-people",
  templateUrl: "./project-people.component.html",
})
export class ProjectPeopleComponent implements OnInit, OnDestroy {
  private currentAccessPolicies: ApItemViewType[];
  private destroy$ = new Subject<void>();
  private organizationId: string;
  private projectId: string;

  private currentAccessPolicies$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService.getProjectPeopleAccessPolicies(params.projectId).then((policies) => {
        return convertToAccessPolicyItemViews(policies);
      })
    )
  );

  private potentialGrantees$ = combineLatest([this.route.params]).pipe(
    switchMap(([params]) =>
      this.accessPolicyService.getPeoplePotentialGrantees(params.organizationId).then((grantees) =>
        grantees.map((granteeView) => {
          let icon: string;
          let type: ApItemEnum;
          let listName = granteeView.name;
          let labelName = granteeView.name;
          if (granteeView.type === "user") {
            icon = AccessSelectorComponent.userIcon;
            type = ApItemEnum.User;
            if (Utils.isNullOrWhitespace(granteeView.name)) {
              listName = granteeView.email;
              labelName = granteeView.email;
            } else {
              listName = `${granteeView.name} (${granteeView.email})`;
            }
          } else if (granteeView.type === "group") {
            icon = AccessSelectorComponent.groupIcon;
            type = ApItemEnum.Group;
          } else if (granteeView.type === "serviceAccount") {
            icon = AccessSelectorComponent.serviceAccountIcon;
            type = ApItemEnum.ServiceAccount;
          } else if (granteeView.type === "project") {
            icon = AccessSelectorComponent.projectIcon;
            type = ApItemEnum.Project;
          }
          return {
            icon: icon,
            type: type,
            id: granteeView.id,
            labelName: labelName,
            listName: listName,
            currentUserInGroup: granteeView.currentUserInGroup,
            currentUser: granteeView.currentUser,
          };
        })
      )
    )
  );

  protected formGroup = new FormGroup({
    accessPolicies: new FormControl([] as ApItemValueType[]),
  });

  protected loading = true;
  protected potentialGrantees: ApItemViewType[];

  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService,
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private accessPolicySelectorService: AccessPolicySelectorService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizationId = params.organizationId;
      this.projectId = params.projectId;
    });

    combineLatest([this.potentialGrantees$, this.currentAccessPolicies$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([potentialGrantees, currentAccessPolicies]) => {
        this.potentialGrantees = potentialGrantees;
        this.setSelected(currentAccessPolicies);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const showAccessRemovalWarning =
      await this.accessPolicySelectorService.showAccessRemovalWarning(
        this.organizationId,
        this.formGroup.value.accessPolicies
      );

    if (showAccessRemovalWarning) {
      const confirmed = await this.showWarning();
      if (!confirmed) {
        this.setSelected(this.currentAccessPolicies);
        return;
      }
    }

    try {
      const projectPeopleView = convertToProjectPeopleAccessPoliciesView(
        this.projectId,
        this.formGroup.value.accessPolicies
      );
      const peoplePoliciesViews = await this.accessPolicyService.putProjectPeopleAccessPolicies(
        this.projectId,
        projectPeopleView
      );
      this.currentAccessPolicies = convertToAccessPolicyItemViews(peoplePoliciesViews);

      if (showAccessRemovalWarning) {
        this.router.navigate(["sm", this.organizationId, "projects"]);
      }
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("projectAccessUpdated")
      );
    } catch (e) {
      this.validationService.showError(e);
      this.setSelected(this.currentAccessPolicies);
    }
  };

  private setSelected(policiesToSelect: ApItemViewType[]) {
    this.loading = true;
    this.currentAccessPolicies = policiesToSelect;
    if (policiesToSelect != undefined) {
      // Must detect changes so that AccessSelector @Inputs() are aware of the latest
      // potentialGrantees, otherwise no selected values will be patched below
      this.changeDetectorRef.detectChanges();
      this.formGroup.patchValue({
        accessPolicies: policiesToSelect.map((m) => ({
          type: m.type,
          id: m.id,
          permission: m.permission,
        })),
      });
    }
    this.loading = false;
  }

  private async showWarning(): Promise<boolean> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "smAccessRemovalWarningProjectTitle" },
      content: { key: "smAccessRemovalWarningProjectMessage" },
      acceptButtonText: { key: "removeAccess" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    return confirmed;
  }
}
