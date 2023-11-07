import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UpdateKeyRequest } from "@bitwarden/common/models/request/update-key.request";

import { RotateUserKeyRequest } from "./request/RotateUserKeyRequest";

@Injectable()
export class KeyRotationApiService {
  readonly apiService = inject(ApiService);

  rotateKeyAndEncryptedData(request: RotateUserKeyRequest): Promise<void> {
    return this.apiService.send("POST", "/accounts/rotate-key", request, true, false);
  }

  postAccountKey(request: UpdateKeyRequest): Promise<any> {
    return this.apiService.send("POST", "/accounts/key", request, true, false);
  }
}
