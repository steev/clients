import { KdfType } from "@bitwarden/common/enums";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { EmergencyAccessStatusType } from "../../core/enums/emergency-access-status-type";
import { EmergencyAccessType } from "../../core/enums/emergency-access-type";

export class GranteeEmergencyAccess {
  id: string;
  granteeId: string;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;
}

export class GrantorEmergencyAccess {
  id: string;
  grantorId: string;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;
}

export class TakeoverTypeEmergencyAccess {
  keyEncrypted: string;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
}

export class ViewTypeEmergencyAccess {
  keyEncrypted: string;
  ciphers: CipherResponse[] = [];
}
