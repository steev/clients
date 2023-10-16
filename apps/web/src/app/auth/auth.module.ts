import { NgModule } from "@angular/core";

import { CoreAuthModule } from "./core/core.module";
import { AuthSettingsModule } from "./settings/settings.module";


@NgModule({
  imports: [AuthSettingsModule, CoreAuthModule],
  declarations: [],
  providers: [],
  exports: [AuthSettingsModule, CoreAuthModule],
})
export class AuthModule {}
