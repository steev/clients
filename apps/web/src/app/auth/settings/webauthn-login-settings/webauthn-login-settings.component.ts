import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { Subject, map, takeUntil } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { DialogService } from "@bitwarden/components";

import { WebauthnLoginService } from "../../core";
import { WebauthnCredentialView } from "../../core/views/webauth-credential.view";

import { openCreateCredentialDialog } from "./create-credential-dialog/create-credential-dialog.component";
import { openDeleteCredentialDialogComponent } from "./delete-credential-dialog/delete-credential-dialog.component";

@Component({
  selector: "app-webauthn-login-settings",
  templateUrl: "webauthn-login-settings.component.html",
  host: {
    "aria-live": "polite",
  },
})
export class WebauthnLoginSettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  protected readonly MaxCredentialCount = WebauthnLoginService.MaxCredentialCount;

  protected credentials?: WebauthnCredentialView[];
  protected loading = true;

  constructor(
    private webauthnService: WebauthnLoginService,
    private dialogService: DialogService,
    private policyService: PolicyService
  ) {}

  @HostBinding("attr.aria-busy")
  get ariaBusy() {
    return this.loading ? "true" : "false";
  }

  get hasCredentials() {
    return this.credentials && this.credentials.length > 0;
  }

  get hasData() {
    return this.credentials !== undefined;
  }

  get limitReached() {
    return this.credentials?.length >= this.MaxCredentialCount;
  }

  requireSsoPolicyEnabled = false;

  ngOnInit(): void {
    this.policyService
      .get$(PolicyType.RequireSso)
      .pipe(
        map((policy) => policy?.enabled ?? false),
        takeUntil(this.destroy$)
      )
      .subscribe((enabled) => {
        this.requireSsoPolicyEnabled = enabled;
      });

    this.webauthnService
      .getCredentials$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((credentials) => (this.credentials = credentials));

    this.webauthnService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe((loading) => (this.loading = loading));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected createCredential() {
    openCreateCredentialDialog(this.dialogService, {});
  }

  protected deleteCredential(credentialId: string) {
    openDeleteCredentialDialogComponent(this.dialogService, { data: { credentialId } });
  }
}
