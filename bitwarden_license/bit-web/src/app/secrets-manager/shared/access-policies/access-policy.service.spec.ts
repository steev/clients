import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";

import {
  AccessPolicyItemType,
  AccessPolicyItemValue,
  AccessPolicyPermission,
} from "./access-policy-selector/access-policy-selector.models";
import { AccessPolicyService } from "./access-policy.service";

describe("AccessPolicyService", () => {
  let cryptoService: MockProxy<CryptoService>;
  let organizationService: MockProxy<OrganizationService>;
  let apiService: MockProxy<ApiService>;
  let encryptService: MockProxy<EncryptService>;

  let sut: AccessPolicyService;

  beforeEach(() => {
    cryptoService = mock<CryptoService>();
    organizationService = mock<OrganizationService>();
    apiService = mock<ApiService>();
    encryptService = mock<EncryptService>();

    sut = new AccessPolicyService(cryptoService, organizationService, apiService, encryptService);
  });

  afterEach(() => jest.resetAllMocks());

  describe("showAccessRemovalWarning", () => {
    it("returns false when current user is admin", async () => {
      const org = orgFactory();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns false when current user is owner", async () => {
      const org = orgFactory();
      org.type = OrganizationUserType.Owner;
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin and all policies are removed", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns true when current user isn't owner/admin and user policy is set to canRead", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [];
      selectedPolicyValues.push(
        createAccessPolicyItemValue({
          permission: AccessPolicyPermission.CanRead,
          currentUser: true,
        })
      );

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns false when current user isn't owner/admin and user policy is set to canReadWrite", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          permission: AccessPolicyPermission.CanReadWrite,
          currentUser: true,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns true when current user isn't owner/admin and a group Read policy is submitted that the user is a member of", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          id: "groupId",
          type: AccessPolicyItemType.Group,
          permission: AccessPolicyPermission.CanRead,
          currentUserInGroup: true,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns false when current user isn't owner/admin and a group ReadWrite policy is submitted that the user is a member of", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          id: "groupId",
          type: AccessPolicyItemType.Group,
          permission: AccessPolicyPermission.CanReadWrite,
          currentUserInGroup: true,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin and a group ReadWrite policy is submitted that the user is not a member of", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          id: "groupId",
          type: AccessPolicyItemType.Group,
          permission: AccessPolicyPermission.CanReadWrite,
          currentUserInGroup: false,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns false when current user isn't owner/admin, user policy is set to CanRead, and user is in read write group", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          permission: AccessPolicyPermission.CanRead,
          currentUser: true,
        }),
        createAccessPolicyItemValue({
          id: "groupId",
          type: AccessPolicyItemType.Group,
          permission: AccessPolicyPermission.CanReadWrite,
          currentUserInGroup: true,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(false);
    });

    it("returns true when current user isn't owner/admin, user policy is set to CanRead, and user is not in ReadWrite group", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          permission: AccessPolicyPermission.CanRead,
          currentUser: true,
        }),
        createAccessPolicyItemValue({
          id: "groupId",
          type: AccessPolicyItemType.Group,
          permission: AccessPolicyPermission.CanReadWrite,
          currentUserInGroup: false,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });

    it("returns true when current user isn't owner/admin, user policy is set to CanRead, and user is in Read group", async () => {
      const org = setupUserOrg();
      organizationService.get.calledWith(org.id).mockReturnValue(org);

      const selectedPolicyValues: AccessPolicyItemValue[] = [
        createAccessPolicyItemValue({
          permission: AccessPolicyPermission.CanRead,
          currentUser: true,
        }),
        createAccessPolicyItemValue({
          id: "groupId",
          type: AccessPolicyItemType.Group,
          permission: AccessPolicyPermission.CanRead,
          currentUserInGroup: true,
        }),
      ];

      const result = await sut.showAccessRemovalWarning(org.id, selectedPolicyValues);

      expect(result).toBe(true);
    });
  });
});

const orgFactory = (props: Partial<Organization> = {}) =>
  Object.assign(
    new Organization(),
    {
      id: "myOrgId",
      enabled: true,
      type: OrganizationUserType.Admin,
    },
    props
  );

function createAccessPolicyItemValue(options: Partial<AccessPolicyItemValue> = {}) {
  return {
    id: options?.id ?? "test",
    type: options?.type ?? AccessPolicyItemType.User,
    permission: options?.permission ?? AccessPolicyPermission.CanRead,
    currentUserInGroup: options?.currentUserInGroup ?? false,
  };
}

function setupUserOrg() {
  const userId = "testUserId";
  const org = orgFactory({ userId: userId });
  org.type = OrganizationUserType.User;
  return org;
}
