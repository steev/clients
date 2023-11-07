import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/common/src/admin-console/abstractions/organization-user/requests/organization-user-reset-password-enrollment.request";
import { SendWithIdRequest } from "@bitwarden/common/src/tools/send/models/request/send-with-id.request";
import { CipherWithIdRequest } from "@bitwarden/common/src/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/src/vault/models/request/folder-with-id.request";

import { EmergencyAccessWithIdRequest } from "../../emergency-access/request/emergency-access-update.request";

export class RotateUserKeyRequest {
  masterPasswordHash: string;
  key: string;
  privateKey: string;
  ciphers: CipherWithIdRequest[] = [];
  folders: FolderWithIdRequest[] = [];
  sends: SendWithIdRequest[] = [];
  emergencyAccessKeys: EmergencyAccessWithIdRequest[] = [];
  accountRecoveryKeys: OrganizationUserResetPasswordWithIdRequest[] = [];
}
