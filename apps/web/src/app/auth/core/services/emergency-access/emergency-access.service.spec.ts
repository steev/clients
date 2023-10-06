import { MockProxy } from "jest-mock-extended";
import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessService } from "./emergency-access.service";

describe("EmergencyAccessService", () => {
  let apiService!: MockProxy<EmergencyAccessApiService>;
  let emergencyAccessService: EmergencyAccessService;

  beforeAll(() => {
    // emergencyAccessService = new EmergencyAccessService();
  });

  describe("updateEmergencyAccesses", () => {
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
      await migrateFromLegacyEncryptionService.updateEmergencyAccesses(mockUserKey);

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

  // describe("createCredential", () => {
  //   it("should return undefined when navigator.credentials throws", async () => {
  //     credentials.create.mockRejectedValue(new Error("Mocked error"));
  //     const options = createCredentialCreateOptions();

  //     const result = await webauthnService.createCredential(options);

  //     expect(result).toBeUndefined();
  //   });
});
