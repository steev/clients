import { SelectItemView } from "@bitwarden/components";

import { ProjectPeopleAccessPoliciesView } from "../../../../models/view/access-policy.view";

import { AccessPolicyItemType, ApItemTypeUtil } from "./enums/access-policy-item-type";
import { AccessPolicyPermission, ApPermissionUtil } from "./enums/access-policy-permission";

export type AccessPolicyItemView =
  | SelectItemView & {
      accessPolicyId?: string;
      permission?: AccessPolicyPermission;
    } & (
        | {
            type: AccessPolicyItemType.User;
            userId?: string;
            currentUser?: boolean;
          }
        | {
            type: AccessPolicyItemType.Group;
            currentUserInGroup?: boolean;
          }
        | {
            type: AccessPolicyItemType.ServiceAccount;
          }
        | {
            type: AccessPolicyItemType.Project;
          }
      );

export function convertToAccessPolicyItemViews(
  value: ProjectPeopleAccessPoliciesView
): AccessPolicyItemView[] {
  const accessPolicies: AccessPolicyItemView[] = [];

  value.userAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: AccessPolicyItemType.User,
      icon: ApItemTypeUtil.itemIcon(AccessPolicyItemType.User),
      id: policy.organizationUserId,
      accessPolicyId: policy.id,
      labelName: policy.organizationUserName,
      listName: policy.organizationUserName,
      permission: ApPermissionUtil.toAccessPolicyPermission(policy.read, policy.write),
      userId: policy.userId,
    });
  });

  value.groupAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: AccessPolicyItemType.Group,
      icon: ApItemTypeUtil.itemIcon(AccessPolicyItemType.Group),
      id: policy.groupId,
      accessPolicyId: policy.id,
      labelName: policy.groupName,
      listName: policy.groupName,
      permission: ApPermissionUtil.toAccessPolicyPermission(policy.read, policy.write),
      currentUserInGroup: policy.currentUserInGroup,
    });
  });

  return accessPolicies;
}
