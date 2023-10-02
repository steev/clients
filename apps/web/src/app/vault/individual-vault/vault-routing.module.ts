import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { deepLinkRedirectGuard } from "../../auth/guards/deep-link-redirect.guard";

import { VaultComponent } from "./vault.component";
const routes: Routes = [
  {
    path: "",
    component: VaultComponent,
    data: { titleId: "vaults" },
    canActivate: [deepLinkRedirectGuard()],
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
