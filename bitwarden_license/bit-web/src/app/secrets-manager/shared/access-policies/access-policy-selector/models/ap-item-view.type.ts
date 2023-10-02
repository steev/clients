import { SelectItemView } from "@bitwarden/components";

import { ProjectPeopleAccessPoliciesView } from "../../../../models/view/access-policy.view";

import { ApItemEnum, ApItemEnumUtil } from "./enums/ap-item.enum";
import { ApPermissionEnum, ApPermissionEnumUtil } from "./enums/ap-permission.enum";

export type ApItemViewType =
  | SelectItemView & {
      accessPolicyId?: string;
      permission?: ApPermissionEnum;
    } & (
        | {
            type: ApItemEnum.User;
            userId?: string;
            currentUser?: boolean;
          }
        | {
            type: ApItemEnum.Group;
            currentUserInGroup?: boolean;
          }
        | {
            type: ApItemEnum.ServiceAccount;
          }
        | {
            type: ApItemEnum.Project;
          }
      );

export function convertToAccessPolicyItemViews(
  value: ProjectPeopleAccessPoliciesView
): ApItemViewType[] {
  const accessPolicies: ApItemViewType[] = [];

  value.userAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: ApItemEnum.User,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.User),
      id: policy.organizationUserId,
      accessPolicyId: policy.id,
      labelName: policy.organizationUserName,
      listName: policy.organizationUserName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      userId: policy.userId,
    });
  });

  value.groupAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: ApItemEnum.Group,
      icon: ApItemEnumUtil.itemIcon(ApItemEnum.Group),
      id: policy.groupId,
      accessPolicyId: policy.id,
      labelName: policy.groupName,
      listName: policy.groupName,
      permission: ApPermissionEnumUtil.toApPermissionEnum(policy.read, policy.write),
      currentUserInGroup: policy.currentUserInGroup,
    });
  });

  return accessPolicies;
}
