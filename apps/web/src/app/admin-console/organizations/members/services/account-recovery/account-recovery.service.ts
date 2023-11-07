import { Injectable } from "@angular/core";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import {
  OrganizationUserResetPasswordRequest,
  OrganizationUserResetPasswordWithIdRequest,
} from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString, EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

@Injectable()
export class AccountRecoveryService {
  constructor(
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private organizationService: OrganizationService,
    private organizationUserService: OrganizationUserService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private i18nService: I18nService
  ) {}

  /**
   * Returns the user key encrypted by the organization's public key.
   * Intended for use in enrollment
   * @param orgId desired organization
   */
  async buildRecoveryKey(orgId: string, userKey?: UserKey): Promise<EncryptedString> {
    // Retrieve Public Key
    const orgKeys = await this.organizationApiService.getKeys(orgId);
    if (orgKeys == null) {
      throw new Error(this.i18nService.t("resetPasswordOrgKeysError"));
    }

    const publicKey = Utils.fromB64ToArray(orgKeys.publicKey);

    // RSA Encrypt user key with organization's public key
    userKey ??= await this.cryptoService.getUserKey();
    if (userKey == null) {
      throw new Error("No user key found");
    }
    const encryptedKey = await this.cryptoService.rsaEncrypt(userKey.key, publicKey);

    return encryptedKey.encryptedString;
  }

  /**
   * Sets a user's master password through account recovery.
   * Intended for organization admins
   * @param newMasterPassword user's new master password
   * @param email user's email
   * @param orgUserId organization user's id
   * @param orgId organization id
   */
  async resetMasterPassword(
    newMasterPassword: string,
    email: string,
    orgUserId: string,
    orgId: string
  ): Promise<void> {
    const response = await this.organizationUserService.getOrganizationUserResetPasswordDetails(
      orgId,
      orgUserId
    );

    if (response == null) {
      throw new Error(this.i18nService.t("resetPasswordDetailsError"));
    }

    // Decrypt Organization's encrypted Private Key with org key
    const orgSymKey = await this.cryptoService.getOrgKey(orgId);
    if (orgSymKey == null) {
      throw new Error("No org key found");
    }
    const decPrivateKey = await this.encryptService.decryptToBytes(
      new EncString(response.encryptedPrivateKey),
      orgSymKey
    );

    // Decrypt User's Reset Password Key to get UserKey
    const decValue = await this.cryptoService.rsaDecrypt(response.resetPasswordKey, decPrivateKey);
    const existingUserKey = new SymmetricCryptoKey(decValue) as UserKey;

    // Create new master key and hash new password
    const newMasterKey = await this.cryptoService.makeMasterKey(
      newMasterPassword,
      email.trim().toLowerCase(),
      response.kdf,
      new KdfConfig(response.kdfIterations, response.kdfMemory, response.kdfParallelism)
    );
    const newMasterKeyHash = await this.cryptoService.hashMasterKey(
      newMasterPassword,
      newMasterKey
    );

    // Create new encrypted user key for the User
    const newUserKey = await this.cryptoService.encryptUserKeyWithMasterKey(
      newMasterKey,
      existingUserKey
    );

    // Create request
    const request = new OrganizationUserResetPasswordRequest();
    request.key = newUserKey[1].encryptedString;
    request.newMasterPasswordHash = newMasterKeyHash;

    // Change user's password
    await this.organizationUserService.putOrganizationUserResetPassword(orgId, orgUserId, request);
  }

  /**
   * Returns existing account recovery keys re-encrypted with the new user key.
   * @param newUserKey the new user key
   */
  async getRotatedKeys(
    newUserKey: UserKey
  ): Promise<OrganizationUserResetPasswordWithIdRequest[] | null> {
    const allOrgs = await this.organizationService.getAll();

    if (!allOrgs) {
      return;
    }

    const requests: OrganizationUserResetPasswordWithIdRequest[] = [];
    for (const org of allOrgs) {
      // If not already enrolled, skip
      if (!org.resetPasswordEnrolled) {
        continue;
      }

      // Re-enroll - encrypt user key with organization public key
      const encryptedKey = await this.buildRecoveryKey(org.id, newUserKey);

      // Create/Execute request
      const request = new OrganizationUserResetPasswordWithIdRequest();
      request.orgId = org.id;
      request.resetPasswordKey = encryptedKey;
      request.masterPasswordHash = "ignored";

      requests.push(request);
    }
    return requests;
  }

  /**
   * @deprecated Nov 6, 2023: Use new Key Rotation Service for posting rotated data.
   */
  async postLegacyRotation(
    userId: string,
    requests: OrganizationUserResetPasswordWithIdRequest[]
  ): Promise<void> {
    if (requests == null) {
      return;
    }
    for (const request of requests) {
      await this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
        request.orgId,
        userId,
        request
      );
    }
  }
}
