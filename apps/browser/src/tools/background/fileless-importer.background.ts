import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";

import { FilelessImportPortNames } from "../enums/fileless-import.enums";

import { FilelessImporterBackground as FilelessImporterBackgroundInterface } from "./abstractions/fileless-importer.background";

class FilelessImporterBackground implements FilelessImporterBackgroundInterface {
  private static readonly filelessImporterPortNames: Set<string> = new Set([
    FilelessImportPortNames.LpImporter,
  ]);

  constructor(
    private configService: ConfigServiceAbstraction,
    private authService: AuthService,
    private policyService: PolicyService
  ) {}

  /**
   * Initializes the fileless importer background logic.
   */
  init() {
    this.setupPortMessageListeners();
  }

  /**
   * Identifies if the user account has a policy that disables personal ownership.
   */
  private async removeIndividualVault(): Promise<boolean> {
    return await firstValueFrom(
      this.policyService.policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
    );
  }

  /**
   * Sets up onConnect listeners for the extension.
   */
  private setupPortMessageListeners() {
    chrome.runtime.onConnect.addListener(this.handlePortOnConnect);
  }

  /**
   * Handles connections from content scripts that affect the fileless importer behavior.
   * Is used to facilitate the passing of data and user actions to enact the import
   * of web content to the Bitwarden vault. Along with this, a check is made to ensure
   * that the feature flag is enabled and the user is authenticated.
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    if (!FilelessImporterBackground.filelessImporterPortNames.has(port.name)) {
      return;
    }

    const filelessImportFeatureFlagEnabled = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.BrowserFilelessImport
    );
    const userAuthStatus = await this.authService.getAuthStatus();
    const removeIndividualVault = await this.removeIndividualVault();
    const filelessImportEnabled =
      filelessImportFeatureFlagEnabled &&
      userAuthStatus === AuthenticationStatus.Unlocked &&
      !removeIndividualVault;
    port.postMessage({ command: "verifyFeatureFlag", filelessImportEnabled });
  };
}

export default FilelessImporterBackground;
