export class EmergencyAccessGranteeView {
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

export class EmergencyAccessGrantorView {
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

export class EmergencyAccessTakeoverView {
  keyEncrypted: string;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
}

export class EmergencyAccessViewView {
  keyEncrypted: string;
  ciphers: CipherResponse[] = [];
}
