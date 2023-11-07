import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UpdateKeyRequest } from "@bitwarden/common/models/request/update-key.request";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";

import { AccountRecoveryService } from "../../admin-console/organizations/members/services/account-recovery/account-recovery.service";
import { EmergencyAccessService } from "../emergency-access";

import { KeyRotationApiService } from "./key-rotation-api.service";
import { RotateUserKeyRequest } from "./request/RotateUserKeyRequest";

@Injectable()
export class KeyRotationService {
  constructor(
    private apiService: KeyRotationApiService,
    private cipherService: CipherService,
    private folderService: FolderService,
    private sendService: SendService,
    private emergencyAccessService: EmergencyAccessService,
    private accountRecoveryService: AccountRecoveryService,
    private deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    private stateService: StateService,
    private configService: ConfigServiceAbstraction
  ) {}

  async rotateUserKeyAndEncryptedData(masterPassword: string): Promise<void> {
    if (!masterPassword) {
      throw new Error("Invalid master password");
    }

    // Create master key to validate the master password
    const masterKey = await this.cryptoService.makeMasterKey(
      masterPassword,
      await this.stateService.getEmail(),
      await this.stateService.getKdfType(),
      await this.stateService.getKdfConfig()
    );

    if (!masterKey) {
      throw new Error("Master key could not be created");
    }

    // Set master key again in case it was lost (could be lost on refresh)
    await this.cryptoService.setMasterKey(masterKey);
    const [newUserKey, newEncUserKey] = await this.cryptoService.makeUserKey(masterKey);

    if (!newUserKey || !newEncUserKey) {
      throw new Error("User key could not be created");
    }

    // Create new request
    const request = new RotateUserKeyRequest();

    // Add new user key
    request.key = newEncUserKey.encryptedString;

    // Add master key hash
    const masterPasswordHash = await this.cryptoService.hashMasterKey(masterPassword, masterKey);
    request.masterPasswordHash = masterPasswordHash;

    // Add re-encrypted data
    request.privateKey = await this.encryptPrivateKey(newUserKey);
    request.ciphers = await this.encryptCiphers(newUserKey);
    request.folders = await this.encryptFolders(newUserKey);
    request.sends = await this.encryptSends(newUserKey);
    request.emergencyAccessKeys = await this.emergencyAccessService.getRotatedKeys(newUserKey);
    request.accountRecoveryKeys = await this.accountRecoveryService.getRotatedKeys(newUserKey);

    if (await this.configService.getFeatureFlag<boolean>(FeatureFlag.KeyRotationImprovements)) {
      await this.apiService.rotateKeyAndEncryptedData(request);
    } else {
      await this.rotateUserKeyAndEncryptedDataLegacy(request);
    }

    await this.deviceTrustCryptoService.rotateDevicesTrust(newUserKey, masterPasswordHash);
  }

  private async encryptPrivateKey(newUserKey: UserKey): Promise<EncryptedString | null> {
    const privateKey = await this.cryptoService.getPrivateKey();
    if (!privateKey) {
      return;
    }
    return (await this.encryptService.encrypt(privateKey, newUserKey)).encryptedString;
  }

  private async encryptCiphers(newUserKey: UserKey): Promise<CipherWithIdRequest[] | null> {
    const ciphers = await this.cipherService.getAllDecrypted();
    if (!ciphers) {
      return;
    }
    return await Promise.all(
      ciphers.map(async (cipher) => {
        const encryptedCipher = await this.cipherService.encrypt(cipher, newUserKey);
        return new CipherWithIdRequest(encryptedCipher);
      })
    );
  }

  private async encryptFolders(newUserKey: UserKey): Promise<FolderWithIdRequest[] | null> {
    const folders = await firstValueFrom(this.folderService.folderViews$);
    if (!folders) {
      return;
    }
    return await Promise.all(
      folders.map(async (folder) => {
        const encryptedFolder = await this.folderService.encrypt(folder, newUserKey);
        return new FolderWithIdRequest(encryptedFolder);
      })
    );
  }

  private async encryptSends(newUserKey: UserKey): Promise<SendWithIdRequest[] | null> {
    const sends = await firstValueFrom(this.sendService.sends$);
    if (!sends) {
      return;
    }
    return await Promise.all(
      sends.map(async (send) => {
        const sendKey = await this.encryptService.decryptToBytes(send.key, null);
        send.key = (await this.encryptService.encrypt(sendKey, newUserKey)) ?? send.key;
        return new SendWithIdRequest(send);
      })
    );
  }

  private async rotateUserKeyAndEncryptedDataLegacy(data: RotateUserKeyRequest): Promise<void> {
    const request = new UpdateKeyRequest();
    request.key = data.key;
    request.masterPasswordHash = data.masterPasswordHash;

    request.privateKey = data.privateKey;
    request.folders = data.folders;
    request.ciphers = data.ciphers;
    request.sends = data.sends;

    // Update keys, ciphers, folders, and sends
    await this.apiService.postAccountKey(request);

    // Update emergency access keys
    await this.emergencyAccessService.postLegacyRotation(data.emergencyAccessKeys);

    // Update account recovery keys
    const userId = await this.stateService.getUserId();
    await this.accountRecoveryService.postLegacyRotation(userId, data.accountRecoveryKeys);
  }
}
