import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ConfigServiceAbstraction } from "../../../platform/abstractions/config/config.service.abstraction";
import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import { PrfKey, SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { AuthService } from "../../abstractions/auth.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";
import { AuthenticationType } from "../../enums/authentication-type";
import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginCredentials } from "../../models/domain/login-credentials";
import { WebAuthnLoginCredentialAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion.view";
import * as webAuthnUtils from "../../utils/webauthn-utils";

import { WebAuthnLoginAssertionResponseRequest } from "./request/webauthn-login-assertion-response.request";
import { CredentialAssertionOptionsResponse } from "./response/credential-assertion-options.response";
import { WebAuthnLoginService } from "./webauthn-login.service";

// Save off the original classes so we can restore them after all tests are done if they exist
const originalPublicKeyCredential = global.PublicKeyCredential;
const originalAuthenticatorAssertionResponse = global.AuthenticatorAssertionResponse;

function randomBytes(length: number): Uint8Array {
  return new Uint8Array(Array.from({ length }, (_, k) => k % 255));
}

// AuthenticatorAssertionResponse && PublicKeyCredential are only available in secure contexts
// so we need to mock them and assign them to the global object to make them available
// for the tests
class MockAuthenticatorAssertionResponse implements AuthenticatorAssertionResponse {
  clientDataJSON: ArrayBuffer = randomBytes(32).buffer;
  authenticatorData: ArrayBuffer = randomBytes(196).buffer;
  signature: ArrayBuffer = randomBytes(72).buffer;
  userHandle: ArrayBuffer = randomBytes(16).buffer;

  clientDataJSONB64Str = Utils.fromBufferToUrlB64(this.clientDataJSON);
  authenticatorDataB64Str = Utils.fromBufferToUrlB64(this.authenticatorData);
  signatureB64Str = Utils.fromBufferToUrlB64(this.signature);
  userHandleB64Str = Utils.fromBufferToUrlB64(this.userHandle);
}

class MockPublicKeyCredential implements PublicKeyCredential {
  authenticatorAttachment = "cross-platform";
  id = "mockCredentialId";
  type = "public-key";
  rawId: ArrayBuffer = randomBytes(32).buffer;
  rawIdB64Str = Utils.fromBufferToB64(this.rawId);

  response: MockAuthenticatorAssertionResponse = new MockAuthenticatorAssertionResponse();

  // Use random 64 character hex string (32 bytes - matters for symmetric key creation)
  // to represent the prf key binary data and convert to ArrayBuffer
  // Creating the array buffer from a known hex value allows us to
  // assert on the value in tests
  private prfKeyArrayBuffer: ArrayBuffer = Utils.hexStringToArrayBuffer(
    "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
  );

  getClientExtensionResults(): any {
    return {
      prf: {
        results: {
          first: this.prfKeyArrayBuffer,
        },
      },
    };
  }

  static isConditionalMediationAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }

  static isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

// We must do this to make the mocked classes available for all the
// assertCredential(...) tests.
global.PublicKeyCredential = MockPublicKeyCredential;
global.AuthenticatorAssertionResponse = MockAuthenticatorAssertionResponse;

describe("WebAuthnLoginService", () => {
  let webAuthnLoginService: WebAuthnLoginService;

  const webAuthnLoginApiService = mock<WebAuthnLoginApiServiceAbstraction>();
  const authService = mock<AuthService>();
  const configService = mock<ConfigServiceAbstraction>();
  const navigatorCredentials = mock<CredentialsContainer>();
  const logService = mock<LogService>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore global after all tests are done
    global.PublicKeyCredential = originalPublicKeyCredential;
    global.AuthenticatorAssertionResponse = originalAuthenticatorAssertionResponse;
  });

  function setup(enabled: boolean): WebAuthnLoginService {
    configService.getFeatureFlag$.mockReturnValue(of(enabled));
    return new WebAuthnLoginService(
      webAuthnLoginApiService,
      authService,
      configService,
      navigatorCredentials,
      logService
    );
  }

  it("instantiates", () => {
    webAuthnLoginService = setup(true);
    expect(webAuthnLoginService).not.toBeFalsy();
  });

  describe("enabled$", () => {
    it("should emit true when feature flag for PasswordlessLogin is enabled", (done) => {
      // Arrange
      const webAuthnLoginService = setup(true);

      // Act & Assert
      webAuthnLoginService.enabled$.subscribe({
        next: (enabled) => {
          expect(enabled).toBe(true);
          done();
        },
        error: done.fail,
      });
    });

    it("should emit false when feature flag for PasswordlessLogin is disabled", (done) => {
      // Arrange
      const webAuthnLoginService = setup(false);

      // Act & Assert
      webAuthnLoginService.enabled$.subscribe({
        next: (enabled) => {
          expect(enabled).toBe(false);
          done();
        },
        error: done.fail,
      });
    });
  });

  describe("getCredentialAssertionOptions()", () => {
    it("should get credential assertion options and return a WebAuthnLoginAssertionOptionsView", async () => {
      // Arrange
      const webAuthnLoginService = setup(true);

      const challenge = "6CG3jqMCVASJVXySMi9KWw";
      const token = "BWWebAuthnLoginAssertionOptions_CfDJ_2KBN892w";
      const timeout = 60000;
      const rpId = "localhost";
      const allowCredentials = [] as PublicKeyCredentialDescriptor[];
      const userVerification = "required";
      const objectName = "webAuthnLoginAssertionOptions";

      const mockedCredentialAssertionOptionsServerResponse = {
        options: {
          challenge: challenge,
          timeout: timeout,
          rpId: rpId,
          allowCredentials: allowCredentials,
          userVerification: userVerification,
          status: "ok",
          errorMessage: "",
        },
        token: token,
        object: objectName,
      };

      const mockedCredentialAssertionOptionsResponse = new CredentialAssertionOptionsResponse(
        mockedCredentialAssertionOptionsServerResponse
      );

      webAuthnLoginApiService.getCredentialAssertionOptions.mockResolvedValue(
        mockedCredentialAssertionOptionsResponse
      );

      // Act
      const result = await webAuthnLoginService.getCredentialAssertionOptions();

      // Assert
      expect(result).toBeInstanceOf(WebAuthnLoginCredentialAssertionOptionsView);
      expect(result.options.challenge).toEqual(Utils.fromUrlB64ToArray(challenge));
      expect(result.options.challenge).toBeInstanceOf(Uint8Array);
      expect(result.options.timeout).toEqual(timeout);
      expect(result.options.rpId).toEqual(rpId);
      expect(result.options.allowCredentials).toEqual(allowCredentials);
      expect(result.options.userVerification).toEqual(userVerification);
      expect(result.token).toEqual(token);
    });
  });

  describe("assertCredential(...)", () => {
    function buildCredentialAssertionOptions(): WebAuthnLoginCredentialAssertionOptionsView {
      // Mock credential assertion options
      const challenge = "6CG3jqMCVASJVXySMi9KWw";
      const token = "BWWebAuthnLoginAssertionOptions_CfDJ_2KBN892w";
      const timeout = 60000;
      const rpId = "localhost";
      const allowCredentials = [] as PublicKeyCredentialDescriptor[];
      const userVerification = "required";
      const objectName = "webAuthnLoginAssertionOptions";

      const credentialAssertionOptionsServerResponse = {
        options: {
          challenge: challenge,
          timeout: timeout,
          rpId: rpId,
          allowCredentials: allowCredentials,
          userVerification: userVerification,
          status: "ok",
          errorMessage: "",
        },
        token: token,
        object: objectName,
      };

      const credentialAssertionOptionsResponse = new CredentialAssertionOptionsResponse(
        credentialAssertionOptionsServerResponse
      );

      return new WebAuthnLoginCredentialAssertionOptionsView(
        credentialAssertionOptionsResponse.options,
        credentialAssertionOptionsResponse.token
      );
    }

    it("should assert the credential and return WebAuthnLoginAssertionView on success", async () => {
      // Arrange
      const webAuthnLoginService = setup(true);
      const credentialAssertionOptions = buildCredentialAssertionOptions();

      // Mock webAuthnUtils functions
      const expectedSaltHex = "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
      const saltArrayBuffer = Utils.hexStringToArrayBuffer(expectedSaltHex);

      const publicKeyCredential = new MockPublicKeyCredential();
      const prfResult: ArrayBuffer =
        publicKeyCredential.getClientExtensionResults().prf?.results?.first;
      const prfKey = new SymmetricCryptoKey(new Uint8Array(prfResult)) as PrfKey;

      jest.mock("../../utils/webauthn-utils");
      const getLoginWithPrfSaltSpy = jest
        .spyOn(webAuthnUtils, "getLoginWithPrfSalt")
        .mockResolvedValue(saltArrayBuffer);
      const createSymmetricKeyFromPrfSpy = jest
        .spyOn(webAuthnUtils, "createSymmetricKeyFromPrf")
        .mockReturnValue(prfKey);

      // Mock implementations
      navigatorCredentials.get.mockResolvedValue(publicKeyCredential);

      // Act
      const result = await webAuthnLoginService.assertCredential(credentialAssertionOptions);

      // Assert

      expect(getLoginWithPrfSaltSpy).toHaveBeenCalled();

      expect(navigatorCredentials.get).toHaveBeenCalledWith(
        expect.objectContaining({
          publicKey: expect.objectContaining({
            ...credentialAssertionOptions.options,
            extensions: expect.objectContaining({
              prf: expect.objectContaining({
                eval: expect.objectContaining({
                  first: saltArrayBuffer,
                }),
              }),
            }),
          }),
        })
      );

      expect(createSymmetricKeyFromPrfSpy).toHaveBeenCalledWith(prfResult);

      expect(result).toBeInstanceOf(WebAuthnLoginCredentialAssertionView);
      expect(result.token).toEqual(credentialAssertionOptions.token);

      expect(result.deviceResponse).toBeInstanceOf(WebAuthnLoginAssertionResponseRequest);
      expect(result.deviceResponse.id).toEqual(publicKeyCredential.id);
      expect(result.deviceResponse.rawId).toEqual(publicKeyCredential.rawIdB64Str);
      expect(result.deviceResponse.type).toEqual(publicKeyCredential.type);
      // extensions being empty could change in the future but for now it is expected
      expect(result.deviceResponse.extensions).toEqual({});
      // but it should never contain any PRF information
      expect("prf" in result.deviceResponse.extensions).toBe(false);

      expect(result.deviceResponse.response).toEqual({
        authenticatorData: publicKeyCredential.response.authenticatorDataB64Str,
        clientDataJSON: publicKeyCredential.response.clientDataJSONB64Str,
        signature: publicKeyCredential.response.signatureB64Str,
        userHandle: publicKeyCredential.response.userHandleB64Str,
      });

      expect(result.prfKey).toEqual(prfKey);
    });

    it("should return undefined on non-PublicKeyCredential browser response", async () => {
      // Arrange
      const webAuthnLoginService = setup(true);
      const credentialAssertionOptions = buildCredentialAssertionOptions();

      // Mock the navigatorCredentials.get to return null
      navigatorCredentials.get.mockResolvedValue(null);

      // Act
      const result = await webAuthnLoginService.assertCredential(credentialAssertionOptions);

      // Assert
      expect(result).toBeUndefined();
    });

    it("should log an error and return undefined when navigatorCredentials.get throws an error", async () => {
      // Arrange
      const webAuthnLoginService = setup(true);
      const credentialAssertionOptions = buildCredentialAssertionOptions();

      // Mock navigatorCredentials.get to throw an error
      const errorMessage = "Simulated error";
      navigatorCredentials.get.mockRejectedValue(new Error(errorMessage));

      // Spy on logService.error
      const logServiceErrorSpy = jest.spyOn(logService, "error");

      // Act
      const result = await webAuthnLoginService.assertCredential(credentialAssertionOptions);

      // Assert
      expect(result).toBeUndefined();
      expect(logServiceErrorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("logIn(...)", () => {
    function buildWebAuthnLoginCredentialAssertionView(): WebAuthnLoginCredentialAssertionView {
      const publicKeyCredential = new MockPublicKeyCredential();

      const deviceResponse = new WebAuthnLoginAssertionResponseRequest(publicKeyCredential);

      const prfKey = new SymmetricCryptoKey(randomBytes(32)) as PrfKey;

      return new WebAuthnLoginCredentialAssertionView("mockToken", deviceResponse, prfKey);
    }

    it("should accept an assertion with a signed challenge and use it to try and login", async () => {
      // Arrange
      const webAuthnLoginService = setup(true); // Assuming setup() is your method to initialize the service
      const assertion = buildWebAuthnLoginCredentialAssertionView();
      const mockAuthResult: AuthResult = new AuthResult();

      jest.spyOn(authService, "logIn").mockResolvedValue(mockAuthResult);

      // Act
      const result = await webAuthnLoginService.logIn(assertion);

      // Assert
      expect(result).toEqual(mockAuthResult);
      expect(authService.logIn).toHaveBeenCalledWith(
        expect.objectContaining({
          token: assertion.token,
          deviceResponse: assertion.deviceResponse,
          prfKey: assertion.prfKey,
          type: AuthenticationType.WebAuthn,
        })
      );

      const callArguments = authService.logIn.mock.calls[0];
      expect(callArguments[0]).toBeInstanceOf(WebAuthnLoginCredentials);
    });
  });
});
