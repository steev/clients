// TODO: Add tests for this strategy

import { ApiService } from "../../abstractions/api.service";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { SymmetricCryptoKey, UserKey } from "../../platform/models/domain/symmetric-crypto-key";
import { AuthService } from "../abstractions/auth.service";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { AuthResult } from "../models/domain/auth-result";
import { WebAuthnLoginCredentials } from "../models/domain/login-credentials";
import { TokenTwoFactorRequest } from "../models/request/identity-token/token-two-factor.request";
import { WebAuthnTokenRequest } from "../models/request/identity-token/webauthn-token.request";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

import { LoginStrategy } from "./login.strategy";

export class WebAuthnLoginStrategy extends LoginStrategy {
  get email() {
    if ("email" in this.tokenRequest) {
      return this.tokenRequest.email;
    }

    return "";
  }

  get accessCode() {
    return "";
  }

  get authRequestId() {
    return "";
  }

  tokenRequest: WebAuthnTokenRequest;
  private credentials: WebAuthnLoginCredentials;

  constructor(
    cryptoService: CryptoService,
    apiService: ApiService,
    tokenService: TokenService,
    appIdService: AppIdService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    logService: LogService,
    stateService: StateService,
    twoFactorService: TwoFactorService,
    private authService: AuthService
  ) {
    super(
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService
    );
  }

  protected setMasterKey(response: IdentityTokenResponse) {
    return Promise.resolve();
  }

  // TODO: ask about PRF crypto service
  protected async setUserKey(idTokenResponse: IdentityTokenResponse) {
    const userDecryptionOptions = idTokenResponse?.userDecryptionOptions;

    if (userDecryptionOptions?.webAuthnPrfOption) {
      const webAuthnPrfOption = idTokenResponse.userDecryptionOptions?.webAuthnPrfOption;

      // decrypt prf encrypted private key
      const privateKey = await this.cryptoService.decryptToBytes(
        webAuthnPrfOption.encryptedPrivateKey,
        this.credentials.prfKey
      );

      // decrypt user key with private key
      const userKey = await this.cryptoService.rsaDecrypt(
        webAuthnPrfOption.encryptedUserKey.encryptedString,
        privateKey
      );

      await this.cryptoService.setUserKey(new SymmetricCryptoKey(userKey) as UserKey);
    }
  }

  protected setPrivateKey(response: IdentityTokenResponse): Promise<void> {
    return Promise.resolve();
  }

  async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string
  ): Promise<AuthResult> {
    // this.tokenRequest.captchaResponse = captchaResponse ?? this.captchaBypassToken;
    return super.logInTwoFactor(twoFactor, captchaResponse);
  }

  async logIn(credentials: WebAuthnLoginCredentials) {
    this.credentials = credentials;

    this.tokenRequest = new WebAuthnTokenRequest(
      credentials.token,
      credentials.deviceResponse,
      await this.buildTwoFactor(credentials.twoFactor),
      await this.buildDeviceRequest()
    );

    const [authResult] = await this.startLogIn();
    return authResult;
  }
}
