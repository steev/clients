import { MockProxy } from "jest-mock-extended";
import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessService } from "./emergency-access.service";

describe("EmergencyAccessService", () => {
  let apiService!: MockProxy<EmergencyAccessApiService>;
  let emergencyAccessService: EmergencyAccessService;

  beforeAll(() => {
    emergencyAccessService = new EmergencyAccessService();
  });

  // describe("createCredential", () => {
  //   it("should return undefined when navigator.credentials throws", async () => {
  //     credentials.create.mockRejectedValue(new Error("Mocked error"));
  //     const options = createCredentialCreateOptions();

  //     const result = await webauthnService.createCredential(options);

  //     expect(result).toBeUndefined();
  //   });
});
