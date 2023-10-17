import { NgModule } from "@angular/core";

import { EmergencyAccessApiService } from "./emergency-access-api.service";
import { EmergencyAccessService } from "./emergency-access.service";

@NgModule({
  declarations: [],
  imports: [],
  providers: [EmergencyAccessApiService, EmergencyAccessService],
})
export class EmergencyAccessModule {}
