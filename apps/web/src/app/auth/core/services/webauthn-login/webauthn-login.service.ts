import { Injectable, Optional } from "@angular/core";
import { BehaviorSubject, filter, from, map, Observable, shareReplay, switchMap, tap } from "rxjs";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { Verification } from "@bitwarden/common/types/verification";

import { WebauthnLoginCredentialPrfStatus } from "../../enums/webauthn-login-credential-prf-status.enum";
import { CredentialCreateOptionsView } from "../../views/credential-create-options.view";
import { PendingWebauthnLoginCredentialView } from "../../views/pending-webauthn-login-credential.view";
import { PendingWebauthnLoginCryptoKeysView } from "../../views/pending-webauthn-login-crypto-keys.view";
import { WebauthnLoginCredentialView } from "../../views/webauthn-login-credential.view";

import { SaveCredentialRequest } from "./request/save-credential.request";
import { WebauthnLoginAttestationResponseRequest } from "./request/webauthn-login-attestation-response.request";
import { createSymmetricKeyFromPrf, getLoginWithPrfSalt } from "./utils";
import { WebauthnLoginApiService } from "./webauthn-login-api.service";

@Injectable({ providedIn: "root" })
export class WebauthnLoginService {
  static readonly MaxCredentialCount = 5;

  private navigatorCredentials: CredentialsContainer;
  private _refresh$ = new BehaviorSubject<void>(undefined);
  private _loading$ = new BehaviorSubject<boolean>(true);
  private readonly credentials$ = this._refresh$.pipe(
    tap(() => this._loading$.next(true)),
    switchMap(() => this.fetchCredentials$()),
    tap(() => this._loading$.next(false)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly loading$ = this._loading$.asObservable();

  constructor(
    private apiService: WebauthnLoginApiService,
    private userVerificationService: UserVerificationService,
    private cryptoService: CryptoService,
    private encryptService: EncryptService,
    @Optional() navigatorCredentials?: CredentialsContainer,
    @Optional() private logService?: LogService
  ) {
    // Default parameters don't work when used with Angular DI
    this.navigatorCredentials = navigatorCredentials ?? navigator.credentials;
  }

  async getCredentialCreateOptions(
    verification: Verification
  ): Promise<CredentialCreateOptionsView> {
    const request = await this.userVerificationService.buildRequest(verification);
    const response = await this.apiService.getCredentialCreateOptions(request);
    return new CredentialCreateOptionsView(response.options, response.token);
  }

  async createCredential(
    credentialOptions: CredentialCreateOptionsView
  ): Promise<PendingWebauthnLoginCredentialView | undefined> {
    const nativeOptions: CredentialCreationOptions = {
      publicKey: credentialOptions.options,
    };
    // TODO: Remove `any` when typescript typings add support for PRF
    nativeOptions.publicKey.extensions = {
      prf: {},
    } as any;

    try {
      const response = await this.navigatorCredentials.create(nativeOptions);
      if (!(response instanceof PublicKeyCredential)) {
        return undefined;
      }
      // TODO: Remove `any` when typescript typings add support for PRF
      const supportsPrf = Boolean((response.getClientExtensionResults() as any).prf?.enabled);
      return new PendingWebauthnLoginCredentialView(credentialOptions, response, supportsPrf);
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  async createCryptoKeys(
    pendingCredential: PendingWebauthnLoginCredentialView
  ): Promise<PendingWebauthnLoginCryptoKeysView | undefined> {
    const nativeOptions: CredentialRequestOptions = {
      publicKey: {
        challenge: pendingCredential.createOptions.options.challenge,
        allowCredentials: [{ id: pendingCredential.deviceResponse.rawId, type: "public-key" }],
        rpId: pendingCredential.createOptions.options.rp.id,
        timeout: pendingCredential.createOptions.options.timeout,
        userVerification:
          pendingCredential.createOptions.options.authenticatorSelection.userVerification,
        // TODO: Remove `any` when typescript typings add support for PRF
        extensions: { prf: { eval: { first: await getLoginWithPrfSalt() } } } as any,
      },
    };

    try {
      const response = await this.navigatorCredentials.get(nativeOptions);
      if (!(response instanceof PublicKeyCredential)) {
        return undefined;
      }
      // TODO: Remove `any` when typescript typings add support for PRF
      const prfResult = (response.getClientExtensionResults() as any).prf?.results?.first;
      const symmetricPrfKey = createSymmetricKeyFromPrf(prfResult);
      const [publicKey, encryptedPrivateKey] = await this.cryptoService.makeKeyPair(
        symmetricPrfKey
      );
      const userKey = await this.cryptoService.getUserKey();
      const rawPublicKey = Utils.fromB64ToArray(publicKey);
      const encryptedUserKey = await this.cryptoService.rsaEncrypt(userKey.key, rawPublicKey);
      const encryptedPublicKey = await this.encryptService.encrypt(rawPublicKey, userKey);

      return new PendingWebauthnLoginCryptoKeysView(
        encryptedUserKey,
        encryptedPublicKey,
        encryptedPrivateKey
      );
    } catch (error) {
      this.logService?.error(error);
      return undefined;
    }
  }

  async saveCredential(
    name: string,
    credential: PendingWebauthnLoginCredentialView,
    cryptoKeys?: PendingWebauthnLoginCryptoKeysView
  ) {
    const request = new SaveCredentialRequest();
    request.deviceResponse = new WebauthnLoginAttestationResponseRequest(credential.deviceResponse);
    request.token = credential.createOptions.token;
    request.name = name;
    request.supportsPrf = credential.supportsPrf;
    request.encryptedUserKey = cryptoKeys?.encryptedUserKey.encryptedString;
    request.encryptedPublicKey = cryptoKeys?.encryptedPublicKey.encryptedString;
    request.encryptedPrivateKey = cryptoKeys?.encryptedPrivateKey.encryptedString;
    await this.apiService.saveCredential(request);
    this.refresh();
  }

  /**
   * List of webauthn credentials saved on the server.
   *
   * **Note:**
   *   - Subscribing might trigger a network request if the credentials haven't been fetched yet.
   *   - The observable is shared and will not create unnecessary duplicate requests.
   *   - The observable will automatically re-fetch if the user adds or removes a credential.
   *   - The observable is lazy and will only fetch credentials when subscribed to.
   *   - Don't subscribe to this in the constructor of a long-running service, as it will keep the observable alive.
   */
  getCredentials$(): Observable<WebauthnLoginCredentialView[]> {
    return this.credentials$;
  }

  getCredential$(credentialId: string): Observable<WebauthnLoginCredentialView> {
    return this.credentials$.pipe(
      map((credentials) => credentials.find((c) => c.id === credentialId)),
      filter((c) => c !== undefined)
    );
  }

  async deleteCredential(credentialId: string, verification: Verification): Promise<void> {
    const request = await this.userVerificationService.buildRequest(verification);
    await this.apiService.deleteCredential(credentialId, request);
    this.refresh();
  }

  private fetchCredentials$(): Observable<WebauthnLoginCredentialView[]> {
    return from(this.apiService.getCredentials()).pipe(
      map((response) =>
        response.data.map(
          (credential) =>
            new WebauthnLoginCredentialView(
              credential.id,
              credential.name,
              credential.prfSupport
                ? WebauthnLoginCredentialPrfStatus.Supported
                : WebauthnLoginCredentialPrfStatus.Unsupported
            )
        )
      )
    );
  }

  private refresh() {
    this._refresh$.next();
  }
}
