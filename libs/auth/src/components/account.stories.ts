import { Injectable } from "@angular/core";
import { Meta, StoryObj, moduleMetadata } from "@storybook/angular";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { AccountSwitcherService } from "../../../../apps/browser/src/auth/popup/services/account-switcher.service";
import { I18nMockService } from "../../../components/src/utils/i18n-mock.service";

import { AccountComponent } from "./account.component";

@Injectable({
  providedIn: "root",
})
class MockAccountSwitcherService {
  SPECIAL_ACCOUNT_ID = "addAccount";

  async selectAccount(id: string) {
    return;
  }
}

export default {
  title: "Auth/Account",
  component: AccountComponent,
  decorators: [
    moduleMetadata({
      providers: [
        { provide: AccountSwitcherService, useClass: MockAccountSwitcherService },
        {
          provide: I18nService,
          useFactory: () => {
            return new I18nMockService({
              switchToAccount: "switchToAccount",
              activeAccount: "activeAccount",
            });
          },
        },
      ],
    }),
  ],
  args: {
    account: {
      id: "John Doe",
      name: "John Doe",
      email: "test@testing.com",
      status: "active",
      isSelected: true,
    },
  },
} as Meta;

type Story = StoryObj<AccountComponent>;

export const Default: Story = {};
