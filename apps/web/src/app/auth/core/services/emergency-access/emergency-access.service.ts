import { Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  SymmetricCryptoKey,
  UserKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { EmergencyAccessStatusType } from "../../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../../enums/emergency-access-type";
import {
  EmergencyAccessGranteeView,
  EmergencyAccessGrantorView,
} from "../../views/emergency-access.view";

import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessAcceptRequest } from "./request/emergency-access-accept.request";
import { EmergencyAccessConfirmRequest } from "./request/emergency-access-confirm.request";
import { EmergencyAccessInviteRequest } from "./request/emergency-access-invite.request";
import { EmergencyAccessUpdateRequest } from "./request/emergency-access-update.request";

@Injectable()
export class EmergencyAccessService {
  constructor(
    private emergencyAccessApiService: EmergencyAccessApiService,
    private apiService: ApiService,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private cipherService: CipherService,
    private logService: LogService
  ) {}

  /**
   * Gets all emergency access that the user has been granted
   */
  async getEmergencyAccessTrusted(): Promise<EmergencyAccessGranteeView[]> {
    return (await this.emergencyAccessApiService.getEmergencyAccessTrusted()).data;
  }

  /**
   * Gets all emergency access that the user has granted
   */
  async getEmergencyAccessGranted(): Promise<EmergencyAccessGrantorView[]> {
    return (await this.emergencyAccessApiService.getEmergencyAccessGranted()).data;
  }

  /**
   * Invites the email address to be an emergency contact
   * Step 1 of the 3 step setup flow
   * Intended for grantor
   * @param email email address of trusted emergency contact
   * @param type type of emergency access
   * @param waitTimeDays number of days to wait before granting access
   */
  async invite(email: string, type: EmergencyAccessType, waitTimeDays: number): Promise<void> {
    const request = new EmergencyAccessInviteRequest();
    request.email = email.trim();
    request.type = type;
    request.waitTimeDays = waitTimeDays;

    await this.emergencyAccessApiService.postEmergencyAccessInvite(request);
  }

  /**
   * Edits an existing emergency access
   * Intended for grantor
   * @param id emergency access id
   * @param type type of emergency access
   * @param waitTimeDays number of days to wait before granting access
   */
  async update(id: string, type: EmergencyAccessType, waitTimeDays: number) {
    const request = new EmergencyAccessUpdateRequest();
    request.type = type;
    request.waitTimeDays = waitTimeDays;

    await this.emergencyAccessApiService.putEmergencyAccess(id, request);
  }

  /**
   * Accepts an emergency access invitation
   * Step 2 of the 3 step setup flow
   * Intended for grantee
   * @param id emergency access id
   * @param token secret token provided in email
   */
  async accept(id: string, token: string): Promise<void> {
    const request = new EmergencyAccessAcceptRequest();
    request.token = token;

    await this.emergencyAccessApiService.postEmergencyAccessAccept(id, request);
  }

  /**
   * Encrypts user key with grantee's public key and sends to bitwarden
   * Step 3 of the 3 step setup flow
   * Intended for grantor
   * @param id emergency access id
   * @param token secret token provided in email
   */
  async confirm(id: string, granteeId: string) {
    const userKey = await this.cryptoService.getUserKey();
    if (!userKey) {
      throw new Error("No user key found");
    }
    const publicKeyResponse = await this.apiService.getUserPublicKey(granteeId);
    const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

    try {
      this.logService.debug(
        "User's fingerprint: " +
          (await this.cryptoService.getFingerprint(granteeId, publicKey)).join("-")
      );
    } catch {
      // Ignore errors since it's just a debug message
    }

    const request = new EmergencyAccessConfirmRequest();
    request.key = await this.encryptKey(userKey, publicKey);
    await this.emergencyAccessApiService.postEmergencyAccessConfirm(id, request);
  }

  /**
   * Requests access to grantor's vault
   * Intended for grantee
   * @param id emergency access id
   */
  requestAccess(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessInitiate(id);
  }

  /**
   * Approves access to grantor's vault
   * Intended for grantor
   * @param id emergency access id
   */
  approve(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessApprove(id);
  }

  /**
   * Rejects access to grantor's vault
   * Intended for grantor
   * @param id emergency access id
   */
  reject(id: string): Promise<void> {
    return this.emergencyAccessApiService.postEmergencyAccessReject(id);
  }

  /**
   * Gets the grantor ciphers for an emergency access in view mode
   * Intended for grantee
   * @param id emergency access id
   */
  async getViewOnlyCiphers(id: string): Promise<CipherView[]> {
    const response = await this.emergencyAccessApiService.postEmergencyAccessView(id);

    const grantorKeyBuffer = await this.cryptoService.rsaDecrypt(response.keyEncrypted);
    const grantorUserKey = new SymmetricCryptoKey(grantorKeyBuffer) as UserKey;

    const ciphers = await this.encryptService.decryptItems(
      response.ciphers.map((c) => new Cipher(c)),
      grantorUserKey
    );
    return ciphers.sort(this.cipherService.getLocaleSortingFunction());
  }

  async rotateEmergencyAccess(newUserKey: UserKey) {
    const emergencyAccess = await this.emergencyAccessApiService.getEmergencyAccessTrusted();
    // Any Invited or Accepted requests won't have the key yet, so we don't need to update them
    const allowedStatuses = new Set([
      EmergencyAccessStatusType.Confirmed,
      EmergencyAccessStatusType.RecoveryInitiated,
      EmergencyAccessStatusType.RecoveryApproved,
    ]);
    const filteredAccesses = emergencyAccess.data.filter((d) => allowedStatuses.has(d.status));

    for (const details of filteredAccesses) {
      // Get public key of grantee
      const publicKeyResponse = await this.apiService.getUserPublicKey(details.granteeId);
      const publicKey = Utils.fromB64ToArray(publicKeyResponse.publicKey);

      // Encrypt new user key with public key
      const encryptedKey = await this.cryptoService.rsaEncrypt(newUserKey.key, publicKey);

      const updateRequest = new EmergencyAccessUpdateRequest();
      updateRequest.type = details.type;
      updateRequest.waitTimeDays = details.waitTimeDays;
      updateRequest.keyEncrypted = encryptedKey.encryptedString;

      await this.emergencyAccessApiService.putEmergencyAccess(details.id, updateRequest);
    }
  }

  private async encryptKey(userKey: UserKey, publicKey: Uint8Array): Promise<EncryptedString> {
    return (await this.cryptoService.rsaEncrypt(userKey.key, publicKey)).encryptedString;
  }
}
