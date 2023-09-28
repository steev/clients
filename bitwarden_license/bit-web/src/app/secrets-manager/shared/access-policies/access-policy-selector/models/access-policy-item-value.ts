import {
  ProjectPeopleAccessPoliciesView,
  UserProjectAccessPolicyView,
  GroupProjectAccessPolicyView,
} from "../../../../models/view/access-policy.view";

import { AccessPolicyItemType } from "./enums/access-policy-item-type";
import { AccessPolicyPermission, ApPermissionUtil } from "./enums/access-policy-permission";

export type AccessPolicyItemValue = {
  id: string;
  type: AccessPolicyItemType;
  permission: AccessPolicyPermission;
  currentUserInGroup?: boolean;
  currentUser?: boolean;
};

export function convertToProjectPeopleAccessPoliciesView(
  projectId: string,
  selectedPolicyValues: AccessPolicyItemValue[]
): ProjectPeopleAccessPoliciesView {
  const view = new ProjectPeopleAccessPoliciesView();
  view.userAccessPolicies = selectedPolicyValues
    .filter((x) => x.type == AccessPolicyItemType.User)
    .map((filtered) => {
      const policyView = new UserProjectAccessPolicyView();
      policyView.grantedProjectId = projectId;
      policyView.organizationUserId = filtered.id;
      policyView.read = ApPermissionUtil.toRead(filtered.permission);
      policyView.write = ApPermissionUtil.toWrite(filtered.permission);
      return policyView;
    });

  view.groupAccessPolicies = selectedPolicyValues
    .filter((x) => x.type == AccessPolicyItemType.Group)
    .map((filtered) => {
      const policyView = new GroupProjectAccessPolicyView();
      policyView.grantedProjectId = projectId;
      policyView.groupId = filtered.id;
      policyView.read = ApPermissionUtil.toRead(filtered.permission);
      policyView.write = ApPermissionUtil.toWrite(filtered.permission);
      return policyView;
    });
  return view;
}
