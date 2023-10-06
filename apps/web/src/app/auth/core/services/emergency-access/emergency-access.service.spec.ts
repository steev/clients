import { MockProxy } from "jest-mock-extended";
import mock from "jest-mock-extended/lib/Mock";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptionType, KdfType } from "@bitwarden/common/enums";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { UserKeyResponse } from "@bitwarden/common/models/response/user-key.response";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  UserKey,
  SymmetricCryptoKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { EmergencyAccessStatusType } from "../../enums/emergency-access-status-type";

import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessService } from "./emergency-access.service";
import { EmergencyAccessUpdateRequest } from "./request/emergency-access-update.request";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessTakeoverResponse,
} from "./response/emergency-access.response";

describe("EmergencyAccessService", () => {
  let emergencyAccessApiService: MockProxy<EmergencyAccessApiService>;
  let apiService: MockProxy<ApiService>;
  let cryptoService: MockProxy<CryptoService>;
  let encryptService: MockProxy<EncryptService>;
  let cipherService: MockProxy<CipherService>;
  let logService: MockProxy<LogService>;
  let emergencyAccessService: EmergencyAccessService;

  beforeAll(() => {
    emergencyAccessApiService = mock<EmergencyAccessApiService>();
    apiService = mock<ApiService>();
    cryptoService = mock<CryptoService>();
    encryptService = mock<EncryptService>();
    cipherService = mock<CipherService>();
    logService = mock<LogService>();

    emergencyAccessService = new EmergencyAccessService(
      emergencyAccessApiService,
      apiService,
      cryptoService,
      encryptService,
      cipherService,
      logService
    );
  });

  describe("takeover", () => {
    const mockId = "emergencyAccessId";
    const mockEmail = "emergencyAccessEmail";
    const mockName = "emergencyAccessName";

    it("should not post a new password if decryption fails", async () => {
      cryptoService.rsaDecrypt.mockResolvedValueOnce(null);
      emergencyAccessApiService.postEmergencyAccessTakeover.mockResolvedValueOnce({
        keyEncrypted: "EncryptedKey",
        kdf: KdfType.PBKDF2_SHA256,
        kdfIterations: 500,
      } as EmergencyAccessTakeoverResponse);

      await expect(
        emergencyAccessService.takeover(mockId, mockEmail, mockName)
      ).rejects.toThrowError("Failed to decrypt grantor key");

      expect(emergencyAccessApiService.postEmergencyAccessPassword).not.toHaveBeenCalled();
    });
  });

  describe("rotate", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;

      const mockEmergencyAccess = {
        data: [
          createMockEmergencyAccess("0", "EA 0", EmergencyAccessStatusType.Invited),
          createMockEmergencyAccess("1", "EA 1", EmergencyAccessStatusType.Accepted),
          createMockEmergencyAccess("2", "EA 2", EmergencyAccessStatusType.Confirmed),
          createMockEmergencyAccess("3", "EA 3", EmergencyAccessStatusType.RecoveryInitiated),
          createMockEmergencyAccess("4", "EA 4", EmergencyAccessStatusType.RecoveryApproved),
        ],
      } as ListResponse<EmergencyAccessGranteeDetailsResponse>;
      emergencyAccessApiService.getEmergencyAccessTrusted.mockResolvedValue(mockEmergencyAccess);
      apiService.getUserPublicKey.mockResolvedValue({
        userId: "mockUserId",
        publicKey: "mockPublicKey",
      } as UserKeyResponse);

      cryptoService.rsaEncrypt.mockImplementation((plainValue, publicKey) => {
        return Promise.resolve(
          new EncString(EncryptionType.Rsa2048_OaepSha1_B64, "Encrypted: " + plainValue)
        );
      });
    });

    it("Only updates emergency accesses with allowed statuses", async () => {
      await emergencyAccessService.rotate(mockUserKey);

      expect(emergencyAccessApiService.putEmergencyAccess).not.toHaveBeenCalledWith(
        "0",
        expect.any(EmergencyAccessUpdateRequest)
      );
      expect(emergencyAccessApiService.putEmergencyAccess).not.toHaveBeenCalledWith(
        "1",
        expect.any(EmergencyAccessUpdateRequest)
      );
    });
  });
});

function createMockEmergencyAccess(
  id: string,
  name: string,
  status: EmergencyAccessStatusType
): EmergencyAccessGranteeDetailsResponse {
  const emergencyAccess = new EmergencyAccessGranteeDetailsResponse({});
  emergencyAccess.id = id;
  emergencyAccess.name = name;
  emergencyAccess.type = 0;
  emergencyAccess.status = status;
  return emergencyAccess;
}
