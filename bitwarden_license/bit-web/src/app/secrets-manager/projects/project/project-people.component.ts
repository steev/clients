import { ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { combineLatest, Subject, switchMap, takeUntil } from "rxjs";

import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";

import { AccessPolicySelectorService } from "../../shared/access-policies/access-policy-selector/access-policy-selector.service";
import {
  AccessPolicyItemValue,
  convertToProjectPeopleAccessPoliciesView,
} from "../../shared/access-policies/access-policy-selector/models/access-policy-item-value";
import {
  AccessPolicyItemView,
  convertToAccessPolicyItemViews,
} from "../../shared/access-policies/access-policy-selector/models/access-policy-item.view";
import { AccessPolicyItemType } from "../../shared/access-policies/access-policy-selector/models/enums/access-policy-item-type";
import { AccessPolicyService } from "../../shared/access-policies/access-policy.service";
import { AccessSelectorComponent } from "../../shared/access-policies/access-selector.component";

@Component({
  selector: "sm-project-people",
  templateUrl: "./project-people.component.html",
})
export class ProjectPeopleComponent implements OnInit, OnDestroy {
  private currentAccessPolicies: AccessPolicyItemView[];
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
          let type: AccessPolicyItemType;
          let listName = granteeView.name;
          let labelName = granteeView.name;
          if (granteeView.type === "user") {
            icon = AccessSelectorComponent.userIcon;
            type = AccessPolicyItemType.User;
            if (Utils.isNullOrWhitespace(granteeView.name)) {
              listName = granteeView.email;
              labelName = granteeView.email;
            } else {
              listName = `${granteeView.name} (${granteeView.email})`;
            }
          } else if (granteeView.type === "group") {
            icon = AccessSelectorComponent.groupIcon;
            type = AccessPolicyItemType.Group;
          } else if (granteeView.type === "serviceAccount") {
            icon = AccessSelectorComponent.serviceAccountIcon;
            type = AccessPolicyItemType.ServiceAccount;
          } else if (granteeView.type === "project") {
            icon = AccessSelectorComponent.projectIcon;
            type = AccessPolicyItemType.Project;
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
    accessPolicies: new FormControl([] as AccessPolicyItemValue[]),
  });

  protected loading = true;
  protected potentialGrantees: AccessPolicyItemView[];

  constructor(
    private route: ActivatedRoute,
    private dialogService: DialogService,
    private changeDetectorRef: ChangeDetectorRef,
    private validationService: ValidationService,
    private accessPolicyService: AccessPolicyService,
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

    if (
      await this.accessPolicySelectorService.showAccessRemovalWarning(
        this.organizationId,
        this.formGroup.value.accessPolicies
      )
    ) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "smAccessRemovalWarningProjectTitle" },
        content: { key: "smAccessRemovalWarningProjectMessage" },
        acceptButtonText: { key: "removeAccess" },
        cancelButtonText: { key: "cancel" },
        type: "warning",
      });
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
    } catch (e) {
      this.validationService.showError(e);
      this.setSelected(this.currentAccessPolicies);
    }
  };

  private setSelected(policiesToSelect: AccessPolicyItemView[]) {
    this.currentAccessPolicies = policiesToSelect;
    this.loading = true;
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
}
