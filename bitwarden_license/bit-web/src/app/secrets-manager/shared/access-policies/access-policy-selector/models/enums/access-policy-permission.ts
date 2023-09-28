export enum AccessPolicyPermission {
  CanRead = "canRead",
  CanReadWrite = "canReadWrite",
}

export class ApPermissionUtil {
  static toAccessPolicyPermission(read: boolean, write: boolean): AccessPolicyPermission {
    if (read && write) {
      return AccessPolicyPermission.CanReadWrite;
    } else if (read) {
      return AccessPolicyPermission.CanRead;
    } else {
      throw new Error("Unsupported Access Policy Permission option");
    }
  }

  static toRead(permission: AccessPolicyPermission): boolean {
    if (
      permission == AccessPolicyPermission.CanRead ||
      permission == AccessPolicyPermission.CanReadWrite
    ) {
      return true;
    }
    return false;
  }
  static toWrite(permission: AccessPolicyPermission): boolean {
    if (permission === AccessPolicyPermission.CanReadWrite) {
      return true;
    }
    return false;
  }
}
