import { NgModule } from "@angular/core";

import { KeyRotationApiService } from "./key-rotation-api.service";
import { KeyRotationService } from "./key-rotation.service";

@NgModule({
  providers: [KeyRotationService, KeyRotationApiService],
})
export class KeyRotationModule {}
