import { EmergencyAccessType } from "../../core/enums/emergency-access-type";

export class EmergencyAccessUpdateRequest {
  type: EmergencyAccessType;
  waitTimeDays: number;
  keyEncrypted?: string;
}
