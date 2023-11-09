import { Utils } from "../../../../platform/misc/utils";

export abstract class WebAuthnLoginResponseRequest {
  id: string;
  rawId: string;
  type: string;
  extensions: Record<string, unknown>;

  constructor(credential: PublicKeyCredential) {
    this.id = credential.id;
    this.rawId = Utils.fromBufferToB64(credential.rawId);
    this.type = credential.type;

    // WARNING: do not add PRF information here by mapping
    // credential.getClientExtensionResults() into the extensions property,
    // as it will be sent to the server (leaking credentials).
    this.extensions = {}; // Extensions are handled client-side
  }
}
