import { Injectable } from "@angular/core";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { AccessPolicyItemValue } from "./models/access-policy-item-value";
import { AccessPolicyItemType } from "./models/enums/access-policy-item-type";
import { AccessPolicyPermission } from "./models/enums/access-policy-permission";

@Injectable({
  providedIn: "root",
})
export class AccessPolicySelectorService {
  constructor(private organizationService: OrganizationService) {}

  async showAccessRemovalWarning(
    organizationId: string,
    selectedPoliciesValues: AccessPolicyItemValue[]
  ): Promise<boolean> {
    const organization = this.organizationService.get(organizationId);
    if (organization.isOwner || organization.isAdmin) {
      return false;
    }

    const selectedUserReadWritePolicy = selectedPoliciesValues.find(
      (s) =>
        s.type === AccessPolicyItemType.User &&
        s.currentUser &&
        s.permission === AccessPolicyPermission.CanReadWrite
    );

    const selectedGroupReadWritePolicies = selectedPoliciesValues.filter(
      (s) =>
        s.type === AccessPolicyItemType.Group &&
        s.permission == AccessPolicyPermission.CanReadWrite &&
        s.currentUserInGroup
    );

    if (selectedGroupReadWritePolicies == null || selectedGroupReadWritePolicies.length == 0) {
      if (selectedUserReadWritePolicy == null) {
        return true;
      } else {
        return false;
      }
    }

    return false;
  }
}
