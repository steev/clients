import { SelectItemView } from "@bitwarden/components";

import { ProjectPeopleAccessPoliciesView } from "../../../models/view/access-policy.view";
import { AccessSelectorComponent } from "../access-selector.component";

export enum AccessPolicyItemType {
  User,
  Group,
  ServiceAccount,
  Project,
}

export enum AccessPolicyPermission {
  CanRead = "canRead",
  CanReadWrite = "canReadWrite",
}

export const convertToAccessPolicyPermission = (read: boolean, write: boolean) => {
  if (read && write) {
    return AccessPolicyPermission.CanReadWrite;
  } else if (read) {
    return AccessPolicyPermission.CanRead;
  } else {
    throw new Error("Unsupported Access Policy Permission option");
  }
};

export const toRead = (permission: AccessPolicyPermission) => {
  if (
    permission == AccessPolicyPermission.CanRead ||
    permission == AccessPolicyPermission.CanReadWrite
  ) {
    return true;
  }
  return false;
};

export const toWrite = (permission: AccessPolicyPermission) => {
  if (permission === AccessPolicyPermission.CanReadWrite) {
    return true;
  }
  return false;
};

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

export type AccessPolicyItemValue = {
  id: string;
  type: AccessPolicyItemType;
  permission: AccessPolicyPermission;
  currentUserInGroup?: boolean;
  currentUser?: boolean;
};

export const convertToAccessPolicyItemViews = (value: ProjectPeopleAccessPoliciesView) => {
  const accessPolicies: AccessPolicyItemView[] = [];

  value.userAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: AccessPolicyItemType.User,
      icon: AccessSelectorComponent.userIcon,
      id: policy.organizationUserId,
      accessPolicyId: policy.id,
      labelName: policy.organizationUserName,
      listName: policy.organizationUserName,
      permission: convertToAccessPolicyPermission(policy.read, policy.write),
      userId: policy.userId,
    });
  });

  value.groupAccessPolicies.forEach((policy) => {
    accessPolicies.push({
      type: AccessPolicyItemType.Group,
      icon: AccessSelectorComponent.groupIcon,
      id: policy.groupId,
      accessPolicyId: policy.id,
      labelName: policy.groupName,
      listName: policy.groupName,
      permission: convertToAccessPolicyPermission(policy.read, policy.write),
      currentUserInGroup: policy.currentUserInGroup,
    });
  });

  return accessPolicies;
};
