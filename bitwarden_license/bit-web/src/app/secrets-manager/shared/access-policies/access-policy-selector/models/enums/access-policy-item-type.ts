export enum AccessPolicyItemType {
  User,
  Group,
  ServiceAccount,
  Project,
}

export class ApItemTypeUtil {
  static itemIcon(type: AccessPolicyItemType): string {
    switch (type) {
      case AccessPolicyItemType.User:
        return "bwi-user";
      case AccessPolicyItemType.Group:
        return "bwi-family";
      case AccessPolicyItemType.ServiceAccount:
        return "bwi-wrench";
      case AccessPolicyItemType.Project:
        return "bwi-collection";
    }
  }
}
