import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ConfigServiceAbstraction } from "../../../platform/abstractions/config/config.service.abstraction";
import { LogService } from "../../../platform/abstractions/log.service";
import { Utils } from "../../../platform/misc/utils";
import { AuthService } from "../../abstractions/auth.service";
import { WebAuthnLoginApiServiceAbstraction } from "../../abstractions/webauthn/webauthn-login-api.service.abstraction";
import { WebAuthnLoginAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-assertion-options.view";

import { CredentialAssertionOptionsResponse } from "./response/credential-assertion-options.response";
import { WebAuthnLoginService } from "./webauthn-login.service";
// import { WebAuthnLoginAssertionView } from "../../models/view/webauthn-login/webauthn-login-assertion.view";

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
      expect(result).toBeInstanceOf(WebAuthnLoginAssertionOptionsView);
      expect(result.options.challenge).toEqual(Utils.fromUrlB64ToArray(challenge));
      expect(result.options.challenge).toBeInstanceOf(Uint8Array);
      expect(result.options.timeout).toEqual(timeout);
      expect(result.options.rpId).toEqual(rpId);
      expect(result.options.allowCredentials).toEqual(allowCredentials);
      expect(result.options.userVerification).toEqual(userVerification);
      expect(result.token).toEqual(token);
    });
  });

  // TODO: finish testing this
  //   describe("assertCredential(...)", () => {
  //     it("should assert credential and return WebAuthnLoginAssertionView on success", async () => {
  //       // Arrange
  //       const webAuthnLoginService = setup(true);

  //       const challenge = "6CG3jqMCVASJVXySMi9KWw";
  //       const token = "BWWebAuthnLoginAssertionOptions_CfDJ_2KBN892w";
  //       const timeout = 60000;
  //       const rpId = "localhost";
  //       const allowCredentials = [] as PublicKeyCredentialDescriptor[];
  //       const userVerification = "required";
  //       const objectName = "webAuthnLoginAssertionOptions";

  //       const mockedCredentialAssertionOptionsServerResponse = {
  //         options: {
  //           challenge: challenge,
  //           timeout: timeout,
  //           rpId: rpId,
  //           allowCredentials: allowCredentials,
  //           userVerification: userVerification,
  //           status: "ok",
  //           errorMessage: "",
  //         },
  //         token: token,
  //         object: objectName,
  //       };

  //       const mockedCredentialAssertionOptionsResponse = new CredentialAssertionOptionsResponse(
  //         mockedCredentialAssertionOptionsServerResponse
  //       );

  //       const mockCredentialOptionsView = new WebAuthnLoginAssertionOptionsView(
  //         mockedCredentialAssertionOptionsResponse.options,
  //         mockedCredentialAssertionOptionsResponse.token
  //       );

  //       const mockPublicKeyCredential = new PublicKeyCredential(/* mock the necessary args */);
  //       const mockGetResponse = new AuthenticatorAssertionResponse(/* mock the necessary args */);
  //       const mockSymmetricKey = {}; // Mock the expected symmetric key

  //       //   jest.spyOn(Utils, "getLoginWithPrfSalt").mockResolvedValue(mockSaltArrayBuffer);
  //       //   jest.spyOn(Utils, "createSymmetricKeyFromPrf").mockReturnValue(mockSymmetricKey);

  //       // Mock implementations
  //       navigatorCredentials.get.mockResolvedValue(mockPublicKeyCredential);
  //       mockPublicKeyCredential.response = mockGetResponse;

  //       // Act
  //       const result = await webAuthnLoginService.assertCredential(mockCredentialOptionsView);

  //       // Assert
  //       expect(navigatorCredentials.get).toHaveBeenCalled();
  //       expect(result).toBeInstanceOf(WebAuthnLoginAssertionView);
  //       // Add more specific assertions based on the expected shape of the result
  //       // For example, assert on the token and symmetric key
  //       expect(result.token).toEqual(mockCredentialOptionsView.token);
  //       expect(result.symmetricKey).toEqual(mockSymmetricKey);
  //     });
  //   });
});
