import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { postLoginRedirectGuard } from "../../core/guards/post-login-redirect.guard";

import { VaultComponent } from "./vault.component";
const routes: Routes = [
  {
    path: "",
    component: VaultComponent,
    data: { titleId: "vaults" },
    canActivate: [postLoginRedirectGuard()],
  },
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
