import { firstValueFrom, merge, Subject, throttleTime } from "rxjs";
import { debounceTime, switchMap } from "rxjs/operators";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  AutofillOverlayVisibility,
  SHOW_AUTOFILL_BUTTON,
} from "@bitwarden/common/autofill/constants";
import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { InlineMenuVisibilitySetting } from "@bitwarden/common/autofill/types";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { buildCipherIcon } from "@bitwarden/common/vault/icon/build-cipher-icon";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LoginUriView } from "@bitwarden/common/vault/models/view/login-uri.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";

import { openUnlockPopout } from "../../auth/popup/utils/auth-popout-window";
import { BrowserApi } from "../../platform/browser/browser-api";
import {
  openAddEditVaultItemPopout,
  openViewVaultItemPopout,
} from "../../vault/popup/utils/vault-popout-window";
import {
  AutofillOverlayElement,
  AutofillOverlayPort,
  MAX_SUB_FRAME_DEPTH,
} from "../enums/autofill-overlay.enum";
import { AutofillService } from "../services/abstractions/autofill.service";
import { generateRandomChars } from "../utils";

import { LockedVaultPendingNotificationsData } from "./abstractions/notification.background";
import {
  FocusedFieldData,
  OverlayAddNewItemMessage,
  OverlayBackground as OverlayBackgroundInterface,
  OverlayBackgroundExtensionMessage,
  OverlayBackgroundExtensionMessageHandlers,
  InlineMenuButtonPortMessageHandlers,
  InlineMenuCipherData,
  InlineMenuListPortMessageHandlers,
  OverlayPortMessage,
  PageDetailsForTab,
  SubFrameOffsetData,
  SubFrameOffsetsForTab,
  CloseInlineMenuMessage,
  ToggleInlineMenuHiddenMessage,
} from "./abstractions/overlay.background";

export class OverlayBackground implements OverlayBackgroundInterface {
  private readonly openUnlockPopout = openUnlockPopout;
  private readonly openViewVaultItemPopout = openViewVaultItemPopout;
  private readonly openAddEditVaultItemPopout = openAddEditVaultItemPopout;
  private pageDetailsForTab: PageDetailsForTab = {};
  private subFrameOffsetsForTab: SubFrameOffsetsForTab = {};
  private portKeyForTab: Record<number, string> = {};
  private expiredPorts: chrome.runtime.Port[] = [];
  private inlineMenuButtonPort: chrome.runtime.Port;
  private inlineMenuListPort: chrome.runtime.Port;
  private inlineMenuCiphers: Map<string, CipherView> = new Map();
  private inlineMenuPageTranslations: Record<string, string>;
  private delayedCloseTimeout: number | NodeJS.Timeout;
  private startInlineMenuFadeInSubject = new Subject<void>();
  private cancelInlineMenuFadeInSubject = new Subject<boolean>();
  private startUpdateInlineMenuPositionSubject = new Subject<chrome.runtime.MessageSender>();
  private cancelUpdateInlineMenuPositionSubject = new Subject<void>();
  private repositionInlineMenuSubject = new Subject<chrome.runtime.MessageSender>();
  private rebuildSubFrameOffsetsSubject = new Subject<chrome.runtime.MessageSender>();
  private focusedFieldData: FocusedFieldData;
  private isFieldCurrentlyFocused: boolean = false;
  private isFieldCurrentlyFilling: boolean = false;
  private isInlineMenuButtonVisible: boolean = false;
  private isInlineMenuListVisible: boolean = false;
  private iconsServerUrl: string;
  private readonly extensionMessageHandlers: OverlayBackgroundExtensionMessageHandlers = {
    autofillOverlayElementClosed: ({ message, sender }) =>
      this.overlayElementClosed(message, sender),
    autofillOverlayAddNewVaultItem: ({ message, sender }) => this.addNewVaultItem(message, sender),
    triggerAutofillOverlayReposition: ({ sender }) => this.triggerOverlayReposition(sender),
    checkIsInlineMenuCiphersPopulated: ({ sender }) =>
      this.checkIsInlineMenuCiphersPopulated(sender),
    updateFocusedFieldData: ({ message, sender }) => this.setFocusedFieldData(message, sender),
    updateIsFieldCurrentlyFocused: ({ message }) => this.updateIsFieldCurrentlyFocused(message),
    checkIsFieldCurrentlyFocused: () => this.checkIsFieldCurrentlyFocused(),
    updateIsFieldCurrentlyFilling: ({ message }) => this.updateIsFieldCurrentlyFilling(message),
    checkIsFieldCurrentlyFilling: () => this.checkIsFieldCurrentlyFilling(),
    getAutofillInlineMenuVisibility: () => this.getInlineMenuVisibility(),
    openAutofillInlineMenu: () => this.openInlineMenu(false),
    closeAutofillInlineMenu: ({ message, sender }) => this.closeInlineMenu(sender, message),
    checkAutofillInlineMenuFocused: ({ sender }) => this.checkInlineMenuFocused(sender),
    focusAutofillInlineMenuList: () => this.focusInlineMenuList(),
    updateAutofillInlineMenuPosition: ({ message, sender }) =>
      this.updateInlineMenuPosition(message, sender),
    updateAutofillInlineMenuElementIsVisibleStatus: ({ message, sender }) =>
      this.updateInlineMenuElementIsVisibleStatus(message, sender),
    checkIsAutofillInlineMenuButtonVisible: () => this.checkIsInlineMenuButtonVisible(),
    checkIsAutofillInlineMenuListVisible: () => this.checkIsInlineMenuListVisible(),
    getCurrentTabFrameId: ({ sender }) => this.getSenderFrameId(sender),
    updateSubFrameData: ({ message, sender }) => this.updateSubFrameData(message, sender),
    triggerSubFrameFocusInRebuild: ({ sender }) => this.triggerSubFrameFocusInRebuild(sender),
    destroyAutofillInlineMenuListeners: ({ message, sender }) =>
      this.triggerDestroyInlineMenuListeners(sender.tab, message.subFrameData.frameId),
    collectPageDetailsResponse: ({ message, sender }) => this.storePageDetails(message, sender),
    unlockCompleted: ({ message }) => this.unlockCompleted(message),
    doFullSync: () => this.updateOverlayCiphers(),
    addedCipher: () => this.updateOverlayCiphers(),
    addEditCipherSubmitted: () => this.updateOverlayCiphers(),
    editedCipher: () => this.updateOverlayCiphers(),
    deletedCipher: () => this.updateOverlayCiphers(),
  };
  private readonly inlineMenuButtonPortMessageHandlers: InlineMenuButtonPortMessageHandlers = {
    triggerDelayedAutofillInlineMenuClosure: ({ port }) => this.triggerDelayedInlineMenuClosure(),
    autofillInlineMenuButtonClicked: ({ port }) => this.handleInlineMenuButtonClicked(port),
    autofillInlineMenuBlurred: () => this.checkInlineMenuListFocused(),
    redirectAutofillInlineMenuFocusOut: ({ message, port }) =>
      this.redirectInlineMenuFocusOut(message, port),
    updateAutofillInlineMenuColorScheme: () => this.updateInlineMenuButtonColorScheme(),
  };
  private readonly inlineMenuListPortMessageHandlers: InlineMenuListPortMessageHandlers = {
    checkAutofillInlineMenuButtonFocused: () => this.checkInlineMenuButtonFocused(),
    autofillInlineMenuBlurred: () => this.checkInlineMenuButtonFocused(),
    unlockVault: ({ port }) => this.unlockVault(port),
    fillAutofillInlineMenuCipher: ({ message, port }) => this.fillInlineMenuCipher(message, port),
    addNewVaultItem: ({ port }) => this.getNewVaultItemDetails(port),
    viewSelectedCipher: ({ message, port }) => this.viewSelectedCipher(message, port),
    redirectAutofillInlineMenuFocusOut: ({ message, port }) =>
      this.redirectInlineMenuFocusOut(message, port),
    updateAutofillInlineMenuListHeight: ({ message }) => this.updateInlineMenuListHeight(message),
  };

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private autofillService: AutofillService,
    private authService: AuthService,
    private environmentService: EnvironmentService,
    private domainSettingsService: DomainSettingsService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private themeStateService: ThemeStateService,
  ) {
    this.initOverlayEventObservables();
  }

  /**
   * Sets up the extension message listeners and gets the settings for the
   * overlay's visibility and the user's authentication status.
   */
  async init() {
    this.setupExtensionListeners();
    const env = await firstValueFrom(this.environmentService.environment$);
    this.iconsServerUrl = env.getIconsUrl();
  }

  /**
   * Initializes event observables that handle events which affect the overlay's behavior.
   */
  private initOverlayEventObservables() {
    this.repositionInlineMenuSubject
      .pipe(
        debounceTime(1000),
        switchMap((sender) => this.repositionInlineMenu(sender)),
      )
      .subscribe();
    this.rebuildSubFrameOffsetsSubject
      .pipe(
        throttleTime(100),
        switchMap((sender) => this.rebuildSubFrameOffsets(sender)),
      )
      .subscribe();

    // Debounce used to update inline menu position
    merge(
      this.startUpdateInlineMenuPositionSubject.pipe(debounceTime(150)),
      this.cancelUpdateInlineMenuPositionSubject,
    )
      .pipe(switchMap((sender) => this.updateInlineMenuPositionAfterRepositionEvent(sender)))
      .subscribe();

    // FadeIn Observable behavior
    merge(
      this.startInlineMenuFadeInSubject.pipe(debounceTime(150)),
      this.cancelInlineMenuFadeInSubject,
    )
      .pipe(switchMap((cancelSignal) => this.triggerInlineMenuFadeIn(!!cancelSignal)))
      .subscribe();
  }

  /**
   * Removes cached page details for a tab
   * based on the passed tabId.
   *
   * @param tabId - Used to reference the page details of a specific tab
   */
  removePageDetails(tabId: number) {
    if (this.pageDetailsForTab[tabId]) {
      this.pageDetailsForTab[tabId].clear();
      delete this.pageDetailsForTab[tabId];
    }

    if (this.portKeyForTab[tabId]) {
      delete this.portKeyForTab[tabId];
    }
  }

  /**
   * Updates the inline menu list's ciphers and sends the updated list to the inline menu list iframe.
   * Queries all ciphers for the given url, and sorts them by last used. Will not update the
   * list of ciphers if the extension is not unlocked.
   */
  async updateOverlayCiphers() {
    const authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    if (authStatus !== AuthenticationStatus.Unlocked) {
      if (this.focusedFieldData) {
        void this.closeInlineMenuAfterCiphersUpdate();
      }
      return;
    }

    const currentTab = await BrowserApi.getTabFromCurrentWindowId();
    if (this.focusedFieldData && currentTab?.id !== this.focusedFieldData.tabId) {
      void this.closeInlineMenuAfterCiphersUpdate();
    }

    this.inlineMenuCiphers = new Map();
    const ciphersViews = (
      await this.cipherService.getAllDecryptedForUrl(currentTab?.url || "")
    ).sort((a, b) => this.cipherService.sortCiphersByLastUsedThenName(a, b));
    for (let cipherIndex = 0; cipherIndex < ciphersViews.length; cipherIndex++) {
      this.inlineMenuCiphers.set(`inline-menu-cipher-${cipherIndex}`, ciphersViews[cipherIndex]);
    }

    const ciphers = await this.getInlineMenuCipherData();
    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuListCiphers",
      ciphers,
    });
  }

  /**
   * Strips out unnecessary data from the ciphers and returns an array of
   * objects that contain the cipher data needed for the inline menu list.
   */
  private async getInlineMenuCipherData(): Promise<InlineMenuCipherData[]> {
    const showFavicons = await firstValueFrom(this.domainSettingsService.showFavicons$);
    const inlineMenuCiphersArray = Array.from(this.inlineMenuCiphers);
    const inlineMenuCipherData: InlineMenuCipherData[] = [];

    for (let cipherIndex = 0; cipherIndex < inlineMenuCiphersArray.length; cipherIndex++) {
      const [inlineMenuCipherId, cipher] = inlineMenuCiphersArray[cipherIndex];

      inlineMenuCipherData.push({
        id: inlineMenuCipherId,
        name: cipher.name,
        type: cipher.type,
        reprompt: cipher.reprompt,
        favorite: cipher.favorite,
        icon: buildCipherIcon(this.iconsServerUrl, cipher, showFavicons),
        login: cipher.type === CipherType.Login ? { username: cipher.login.username } : null,
        card: cipher.type === CipherType.Card ? cipher.card.subTitle : null,
      });
    }

    return inlineMenuCipherData;
  }

  /**
   * Gets the currently focused field and closes the inline menu on that tab.
   */
  private async closeInlineMenuAfterCiphersUpdate() {
    const focusedFieldTab = await BrowserApi.getTab(this.focusedFieldData.tabId);
    this.closeInlineMenu({ tab: focusedFieldTab }, { forceCloseInlineMenu: true });
  }

  /**
   * Handles aggregation of page details for a tab. Stores the page details
   * in association with the tabId of the tab that sent the message.
   *
   * @param message - Message received from the `collectPageDetailsResponse` command
   * @param sender - The sender of the message
   */
  private storePageDetails(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const pageDetails = {
      frameId: sender.frameId,
      tab: sender.tab,
      details: message.details,
    };

    if (pageDetails.frameId !== 0 && pageDetails.details.fields.length) {
      void this.buildSubFrameOffsets(pageDetails.tab, pageDetails.frameId, pageDetails.details.url);
      void BrowserApi.tabSendMessage(pageDetails.tab, {
        command: "setupRebuildSubFrameOffsetsListeners",
      });
    }

    const pageDetailsMap = this.pageDetailsForTab[sender.tab.id];
    if (!pageDetailsMap) {
      this.pageDetailsForTab[sender.tab.id] = new Map([[sender.frameId, pageDetails]]);
      return;
    }

    pageDetailsMap.set(sender.frameId, pageDetails);
  }

  /**
   * Returns the frameId, called when calculating sub frame offsets within the tab.
   * Is used to determine if we should reposition the inline menu when a resize event
   * occurs within a frame.
   *
   * @param sender - The sender of the message
   */
  private getSenderFrameId(sender: chrome.runtime.MessageSender) {
    return sender.frameId;
  }

  /**
   * Handles sub frame offset calculations for the given tab and frame id.
   * Is used in setting the position of the inline menu list and button.
   *
   * @param message - The message received from the `updateSubFrameData` command
   * @param sender - The sender of the message
   */
  private updateSubFrameData(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      subFrameOffsetsForTab.set(message.subFrameData.frameId, message.subFrameData);
    }
  }

  /**
   * Builds the offset data for a sub frame of a tab. The offset data is used
   * to calculate the position of the inline menu list and button.
   *
   * @param tab - The tab that the sub frame is associated with
   * @param frameId - The frame ID of the sub frame
   * @param url - The URL of the sub frame
   * @param forceRebuild - Identifies whether the sub frame offsets should be rebuilt
   */
  private async buildSubFrameOffsets(
    tab: chrome.tabs.Tab,
    frameId: number,
    url: string,
    forceRebuild: boolean = false,
  ) {
    let subFrameDepth = 0;
    const tabId = tab.id;
    let subFrameOffsetsForTab = this.subFrameOffsetsForTab[tabId];
    if (!subFrameOffsetsForTab) {
      this.subFrameOffsetsForTab[tabId] = new Map();
      subFrameOffsetsForTab = this.subFrameOffsetsForTab[tabId];
    }

    if (!forceRebuild && subFrameOffsetsForTab.get(frameId)) {
      return;
    }

    const subFrameData: SubFrameOffsetData = { url, top: 0, left: 0, parentFrameIds: [0] };
    let frameDetails = await BrowserApi.getFrameDetails({ tabId, frameId });

    while (frameDetails && frameDetails.parentFrameId > -1) {
      subFrameDepth++;
      if (subFrameDepth >= MAX_SUB_FRAME_DEPTH) {
        subFrameOffsetsForTab.set(frameId, null);
        this.triggerDestroyInlineMenuListeners(tab, frameId);
        return;
      }

      const subFrameOffset: SubFrameOffsetData = await BrowserApi.tabSendMessage(
        tab,
        {
          command: "getSubFrameOffsets",
          subFrameUrl: frameDetails.url,
          subFrameId: frameDetails.documentId,
        },
        { frameId: frameDetails.parentFrameId },
      );

      if (!subFrameOffset) {
        subFrameOffsetsForTab.set(frameId, null);
        void BrowserApi.tabSendMessage(
          tab,
          { command: "getSubFrameOffsetsFromWindowMessage", subFrameId: frameId },
          { frameId },
        );
        return;
      }

      subFrameData.top += subFrameOffset.top;
      subFrameData.left += subFrameOffset.left;
      if (!subFrameData.parentFrameIds.includes(frameDetails.parentFrameId)) {
        subFrameData.parentFrameIds.push(frameDetails.parentFrameId);
      }

      frameDetails = await BrowserApi.getFrameDetails({
        tabId,
        frameId: frameDetails.parentFrameId,
      });
    }

    subFrameOffsetsForTab.set(frameId, subFrameData);
  }

  /**
   * Triggers a removal and destruction of all
   *
   * @param tab - The tab that the sub frame is associated with
   * @param frameId - The frame ID of the sub frame
   */
  private triggerDestroyInlineMenuListeners(tab: chrome.tabs.Tab, frameId: number) {
    this.logService.error(
      "Excessive frame depth encountered, destroying inline menu on field within frame",
      tab,
      frameId,
    );

    void BrowserApi.tabSendMessage(
      tab,
      { command: "destroyAutofillInlineMenuListeners" },
      { frameId },
    );
  }

  /**
   * Rebuilds the sub frame offsets for the tab associated with the sender.
   *
   * @param sender - The sender of the message
   */
  private async rebuildSubFrameOffsets(sender: chrome.runtime.MessageSender) {
    this.cancelUpdateInlineMenuPositionSubject.next();
    this.clearDelayedInlineMenuClosure();

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      const tabFrameIds = Array.from(subFrameOffsetsForTab.keys());
      for (const frameId of tabFrameIds) {
        await this.buildSubFrameOffsets(sender.tab, frameId, sender.url, true);
      }
    }
  }

  /**
   * Handles updating the inline menu's position after rebuilding the sub frames
   * for the provided tab. Will skip repositioning the inline menu if the field
   * is not currently focused, or if the focused field has a value.
   *
   * @param sender - The sender of the message
   */
  private async updateInlineMenuPositionAfterRepositionEvent(
    sender: chrome.runtime.MessageSender | void,
  ) {
    if (!sender || !this.isFieldCurrentlyFocused) {
      return;
    }

    if (!this.checkIsInlineMenuButtonVisible()) {
      void this.toggleInlineMenuHidden(
        { isInlineMenuHidden: false, setTransparentInlineMenu: true },
        sender,
      );
    }

    void this.updateInlineMenuPosition({ overlayElement: AutofillOverlayElement.Button }, sender);

    const mostRecentlyFocusedFieldHasValue = await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "checkMostRecentlyFocusedFieldHasValue" },
      { frameId: this.focusedFieldData?.frameId },
    );

    if ((await this.getInlineMenuVisibility()) === AutofillOverlayVisibility.OnButtonClick) {
      return;
    }

    if (
      mostRecentlyFocusedFieldHasValue &&
      (this.checkIsInlineMenuCiphersPopulated(sender) ||
        (await this.getAuthStatus()) !== AuthenticationStatus.Unlocked)
    ) {
      return;
    }

    void this.updateInlineMenuPosition({ overlayElement: AutofillOverlayElement.List }, sender);
  }

  /**
   * Triggers autofill for the selected cipher in the inline menu list. Also places
   * the selected cipher at the top of the list of ciphers.
   *
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async fillInlineMenuCipher(
    { inlineMenuCipherId }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const pageDetails = this.pageDetailsForTab[sender.tab.id];
    if (!inlineMenuCipherId || !pageDetails?.size) {
      return;
    }

    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);

    if (await this.autofillService.isPasswordRepromptRequired(cipher, sender.tab)) {
      return;
    }
    const totpCode = await this.autofillService.doAutoFill({
      tab: sender.tab,
      cipher: cipher,
      pageDetails: Array.from(pageDetails.values()),
      fillNewPassword: true,
      allowTotpAutofill: true,
    });

    if (totpCode) {
      this.platformUtilsService.copyToClipboard(totpCode);
    }

    this.inlineMenuCiphers = new Map([[inlineMenuCipherId, cipher], ...this.inlineMenuCiphers]);
  }

  /**
   * Checks if the inline menu is focused. Will check the inline menu list
   * if it is open, otherwise it will check the inline menu button.
   */
  private checkInlineMenuFocused(sender: chrome.runtime.MessageSender) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    if (this.inlineMenuListPort) {
      this.checkInlineMenuListFocused();

      return;
    }

    this.checkInlineMenuButtonFocused();
  }

  /**
   * Posts a message to the inline menu button iframe to check if it is focused.
   */
  private checkInlineMenuButtonFocused() {
    this.inlineMenuButtonPort?.postMessage({ command: "checkAutofillInlineMenuButtonFocused" });
  }

  /**
   * Posts a message to the inline menu list iframe to check if it is focused.
   */
  private checkInlineMenuListFocused() {
    this.inlineMenuListPort?.postMessage({ command: "checkAutofillInlineMenuListFocused" });
  }

  /**
   * Sends a message to the sender tab to close the autofill inline menu.
   *
   * @param sender - The sender of the port message
   * @param forceCloseInlineMenu - Identifies whether the inline menu should be forced closed
   * @param overlayElement - The overlay element to close, either the list or button
   */
  private closeInlineMenu(
    sender: chrome.runtime.MessageSender,
    { forceCloseInlineMenu, overlayElement }: CloseInlineMenuMessage = {},
  ) {
    const command = "closeAutofillInlineMenu";
    const sendOptions = { frameId: 0 };
    if (forceCloseInlineMenu) {
      void BrowserApi.tabSendMessage(sender.tab, { command, overlayElement }, sendOptions);
      this.isInlineMenuButtonVisible = false;
      this.isInlineMenuListVisible = false;
      return;
    }

    if (this.isFieldCurrentlyFocused) {
      return;
    }

    if (this.isFieldCurrentlyFilling) {
      void BrowserApi.tabSendMessage(
        sender.tab,
        { command, overlayElement: AutofillOverlayElement.List },
        sendOptions,
      );
      this.isInlineMenuListVisible = false;
      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.isInlineMenuButtonVisible = false;
    }

    if (overlayElement === AutofillOverlayElement.List) {
      this.isInlineMenuListVisible = false;
    }

    if (!overlayElement) {
      this.isInlineMenuButtonVisible = false;
      this.isInlineMenuListVisible = false;
    }

    void BrowserApi.tabSendMessage(sender.tab, { command, overlayElement }, sendOptions);
  }

  /**
   * Sends a message to the sender tab to trigger a delayed closure of the inline menu.
   * This is used to ensure that we capture click events on the inline menu in the case
   * that some on page programmatic method attempts to force focus redirection.
   */
  private triggerDelayedInlineMenuClosure() {
    if (this.isFieldCurrentlyFocused) {
      return;
    }

    this.clearDelayedInlineMenuClosure();
    this.delayedCloseTimeout = globalThis.setTimeout(() => {
      const message = { command: "triggerDelayedAutofillInlineMenuClosure" };
      this.inlineMenuButtonPort?.postMessage(message);
      this.inlineMenuListPort?.postMessage(message);
    }, 100);
  }

  /**
   * Clears the delayed closure timeout for the inline menu, effectively
   * cancelling the event from occurring.
   */
  private clearDelayedInlineMenuClosure() {
    if (this.delayedCloseTimeout) {
      clearTimeout(this.delayedCloseTimeout);
    }
  }

  /**
   * Handles cleanup when an overlay element is closed. Disconnects
   * the list and button ports and sets them to null.
   *
   * @param overlayElement - The overlay element that was closed, either the list or button
   * @param sender - The sender of the port message
   */
  private overlayElementClosed(
    { overlayElement }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      this.expiredPorts.forEach((port) => port.disconnect());
      this.expiredPorts = [];

      return;
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.inlineMenuButtonPort?.disconnect();
      this.inlineMenuButtonPort = null;
      this.isInlineMenuButtonVisible = false;

      return;
    }

    this.inlineMenuListPort?.disconnect();
    this.inlineMenuListPort = null;
    this.isInlineMenuListVisible = false;
  }

  /**
   * Updates the position of either the inline menu list or button. The position
   * is based on the focused field's position and dimensions.
   *
   * @param overlayElement - The overlay element to update, either the list or button
   * @param sender - The sender of the port message
   */
  private async updateInlineMenuPosition(
    { overlayElement }: { overlayElement?: string },
    sender: chrome.runtime.MessageSender,
  ) {
    if (!overlayElement || !this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.cancelInlineMenuFadeInAndPositionUpdate();

    await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "appendAutofillInlineMenuToDom", overlayElement },
      { frameId: 0 },
    );

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[this.focusedFieldData.tabId];
    let subFrameOffsets: SubFrameOffsetData;
    if (subFrameOffsetsForTab) {
      subFrameOffsets = subFrameOffsetsForTab.get(this.focusedFieldData.frameId);
      if (subFrameOffsets === null) {
        this.rebuildSubFrameOffsetsSubject.next(sender);
        this.startUpdateInlineMenuPositionSubject.next(sender);
        return;
      }
    }

    if (overlayElement === AutofillOverlayElement.Button) {
      this.inlineMenuButtonPort?.postMessage({
        command: "updateAutofillInlineMenuPosition",
        styles: this.getInlineMenuButtonPosition(subFrameOffsets),
      });
      this.startInlineMenuFadeIn();

      return;
    }

    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuPosition",
      styles: this.getInlineMenuListPosition(subFrameOffsets),
    });
    this.startInlineMenuFadeIn();
  }

  /**
   * Triggers an update of the inline menu's visibility after the top level frame
   * appends the element to the DOM.
   *
   * @param message - The message received from the content script
   * @param sender - The sender of the port message
   */
  private updateInlineMenuElementIsVisibleStatus(
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    const { overlayElement, isVisible } = message;
    if (overlayElement === AutofillOverlayElement.Button) {
      this.isInlineMenuButtonVisible = isVisible;
      return;
    }

    if (overlayElement === AutofillOverlayElement.List) {
      this.isInlineMenuListVisible = isVisible;
    }
  }

  /**
   * Handles updating the opacity of both the inline menu button and list.
   * This is used to simultaneously fade in the inline menu elements.
   */
  private startInlineMenuFadeIn() {
    this.cancelInlineMenuFadeIn();
    this.startInlineMenuFadeInSubject.next();
  }

  /**
   * Clears the timeout used to fade in the inline menu elements.
   */
  private cancelInlineMenuFadeIn() {
    this.cancelInlineMenuFadeInSubject.next(true);
  }

  /**
   * Posts a message to the inline menu elements to trigger a fade in of the inline menu.
   *
   * @param cancelFadeIn - Signal passed to debounced observable to cancel the fade in
   */
  private async triggerInlineMenuFadeIn(cancelFadeIn: boolean = false) {
    if (cancelFadeIn) {
      return;
    }

    const message = { command: "fadeInAutofillInlineMenuIframe" };
    this.inlineMenuButtonPort?.postMessage(message);
    this.inlineMenuListPort?.postMessage(message);
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the inline menu button based on the focused field's position and dimensions.
   */
  private getInlineMenuButtonPosition(subFrameOffsets: SubFrameOffsetData) {
    const subFrameTopOffset = subFrameOffsets?.top || 0;
    const subFrameLeftOffset = subFrameOffsets?.left || 0;

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;
    const { paddingRight, paddingLeft } = this.focusedFieldData.focusedFieldStyles;
    let elementOffset = height * 0.37;
    if (height >= 35) {
      elementOffset = height >= 50 ? height * 0.47 : height * 0.42;
    }

    const fieldPaddingRight = parseInt(paddingRight, 10);
    const fieldPaddingLeft = parseInt(paddingLeft, 10);
    const elementHeight = height - elementOffset;

    const elementTopPosition = subFrameTopOffset + top + elementOffset / 2;
    const elementLeftPosition =
      fieldPaddingRight > fieldPaddingLeft
        ? subFrameLeftOffset + left + width - height - (fieldPaddingRight - elementOffset + 2)
        : subFrameLeftOffset + left + width - height + elementOffset / 2;

    return {
      top: `${Math.round(elementTopPosition)}px`,
      left: `${Math.round(elementLeftPosition)}px`,
      height: `${Math.round(elementHeight)}px`,
      width: `${Math.round(elementHeight)}px`,
    };
  }

  /**
   * Gets the position of the focused field and calculates the position
   * of the inline menu list based on the focused field's position and dimensions.
   */
  private getInlineMenuListPosition(subFrameOffsets: SubFrameOffsetData) {
    const subFrameTopOffset = subFrameOffsets?.top || 0;
    const subFrameLeftOffset = subFrameOffsets?.left || 0;

    const { top, left, width, height } = this.focusedFieldData.focusedFieldRects;
    return {
      width: `${Math.round(width)}px`,
      top: `${Math.round(top + height + subFrameTopOffset)}px`,
      left: `${Math.round(left + subFrameLeftOffset)}px`,
    };
  }

  /**
   * Sets the focused field data to the data passed in the extension message.
   *
   * @param focusedFieldData - Contains the rects and styles of the focused field.
   * @param sender - The sender of the extension message
   */
  private setFocusedFieldData(
    { focusedFieldData }: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (this.focusedFieldData?.frameId && this.focusedFieldData.frameId !== sender.frameId) {
      void BrowserApi.tabSendMessage(
        sender.tab,
        { command: "unsetMostRecentlyFocusedField" },
        { frameId: this.focusedFieldData.frameId },
      );
    }

    this.focusedFieldData = { ...focusedFieldData, tabId: sender.tab.id, frameId: sender.frameId };
  }

  /**
   * Updates the inline menu's visibility based on the display property passed in the extension message.
   *
   * @param display - The display property of the inline menu, either "block" or "none"
   * @param sender - The sender of the extension message
   */
  private async toggleInlineMenuHidden(
    { isInlineMenuHidden, setTransparentInlineMenu }: ToggleInlineMenuHiddenMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    this.cancelInlineMenuFadeIn();
    const display = isInlineMenuHidden ? "none" : "block";
    let styles: { display: string; opacity?: string } = { display };

    if (typeof setTransparentInlineMenu !== "undefined") {
      const opacity = setTransparentInlineMenu ? "0" : "1";
      styles = { ...styles, opacity };
    }

    const portMessage = { command: "toggleAutofillInlineMenuHidden", styles };
    if (this.inlineMenuButtonPort) {
      this.isInlineMenuButtonVisible = !isInlineMenuHidden;
      this.inlineMenuButtonPort.postMessage(portMessage);
    }

    if (this.inlineMenuListPort) {
      this.isInlineMenuListVisible = !isInlineMenuHidden;
      this.inlineMenuListPort.postMessage(portMessage);
    }

    if (setTransparentInlineMenu) {
      this.startInlineMenuFadeIn();
    }
  }

  /**
   * Sends a message to the currently active tab to open the autofill inline menu.
   *
   * @param isFocusingFieldElement - Identifies whether the field element should be focused when the inline menu is opened
   * @param isOpeningFullInlineMenu - Identifies whether the full inline menu should be forced open regardless of other states
   */
  private async openInlineMenu(isFocusingFieldElement = false, isOpeningFullInlineMenu = false) {
    this.clearDelayedInlineMenuClosure();
    const currentTab = await BrowserApi.getTabFromCurrentWindowId();

    await BrowserApi.tabSendMessage(
      currentTab,
      {
        command: "openAutofillInlineMenu",
        isFocusingFieldElement,
        isOpeningFullInlineMenu,
        authStatus: await this.getAuthStatus(),
      },
      {
        frameId:
          this.focusedFieldData?.tabId === currentTab?.id ? this.focusedFieldData.frameId : 0,
      },
    );
  }

  /**
   * Gets the inline menu's visibility setting from the settings service.
   */
  private async getInlineMenuVisibility(): Promise<InlineMenuVisibilitySetting> {
    return await firstValueFrom(this.autofillSettingsService.inlineMenuVisibility$);
  }

  /**
   * Gets the user's authentication status from the auth service. If the user's authentication
   * status has changed, the inline menu button's authentication status will be updated
   * and the inline menu list's ciphers will be updated.
   */
  private async getAuthStatus() {
    return await firstValueFrom(this.authService.activeAccountStatus$);
  }

  /**
   * Sends a message to the inline menu button to update its authentication status.
   */
  private async updateInlineMenuButtonAuthStatus() {
    this.inlineMenuButtonPort?.postMessage({
      command: "updateInlineMenuButtonAuthStatus",
      authStatus: await this.getAuthStatus(),
    });
  }

  /**
   * Handles the inline menu button being clicked. If the user is not authenticated,
   * the vault will be unlocked. If the user is authenticated, the inline menu will
   * be opened.
   *
   * @param port - The port of the inline menu button
   */
  private async handleInlineMenuButtonClicked(port: chrome.runtime.Port) {
    this.clearDelayedInlineMenuClosure();
    this.cancelInlineMenuFadeInAndPositionUpdate();

    if ((await this.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
      await this.unlockVault(port);
      return;
    }

    await this.openInlineMenu(false, true);
  }

  /**
   * Facilitates opening the unlock popout window.
   *
   * @param port - The port of the inline menu list
   */
  private async unlockVault(port: chrome.runtime.Port) {
    const { sender } = port;

    this.closeInlineMenu(port.sender);
    const retryMessage: LockedVaultPendingNotificationsData = {
      commandToRetry: { message: { command: "openAutofillInlineMenu" }, sender },
      target: "overlay.background",
    };
    await BrowserApi.tabSendMessageData(
      sender.tab,
      "addToLockedVaultPendingNotifications",
      retryMessage,
    );
    await this.openUnlockPopout(sender.tab, true);
  }

  /**
   * Triggers the opening of a vault item popout window associated
   * with the passed cipher ID.
   * @param inlineMenuCipherId - Cipher ID corresponding to the inlineMenuCiphers map. Does not correspond to the actual cipher's ID.
   * @param sender - The sender of the port message
   */
  private async viewSelectedCipher(
    { inlineMenuCipherId }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    const cipher = this.inlineMenuCiphers.get(inlineMenuCipherId);
    if (!cipher) {
      return;
    }

    this.closeInlineMenu(sender);
    await this.openViewVaultItemPopout(sender.tab, {
      cipherId: cipher.id,
      action: SHOW_AUTOFILL_BUTTON,
    });
  }

  /**
   * Facilitates redirecting focus to the inline menu list.
   */
  private focusInlineMenuList() {
    this.inlineMenuListPort?.postMessage({ command: "focusAutofillInlineMenuList" });
  }

  /**
   * Updates the authentication status for the user and opens the inline menu if
   * a followup command is present in the message.
   *
   * @param message - Extension message received from the `unlockCompleted` command
   */
  private async unlockCompleted(message: OverlayBackgroundExtensionMessage) {
    await this.updateInlineMenuButtonAuthStatus();
    await this.updateOverlayCiphers();

    if (message.data?.commandToRetry?.message?.command === "openAutofillInlineMenu") {
      await this.openInlineMenu(true);
    }
  }

  /**
   * Gets the translations for the inline menu page.
   */
  private getInlineMenuTranslations() {
    if (!this.inlineMenuPageTranslations) {
      this.inlineMenuPageTranslations = {
        locale: BrowserApi.getUILanguage(),
        opensInANewWindow: this.i18nService.translate("opensInANewWindow"),
        buttonPageTitle: this.i18nService.translate("bitwardenOverlayButton"),
        toggleBitwardenVaultOverlay: this.i18nService.translate("toggleBitwardenVaultOverlay"),
        listPageTitle: this.i18nService.translate("bitwardenVault"),
        unlockYourAccount: this.i18nService.translate("unlockYourAccountToViewMatchingLogins"),
        unlockAccount: this.i18nService.translate("unlockAccount"),
        fillCredentialsFor: this.i18nService.translate("fillCredentialsFor"),
        username: this.i18nService.translate("username")?.toLowerCase(),
        view: this.i18nService.translate("view"),
        noItemsToShow: this.i18nService.translate("noItemsToShow"),
        newItem: this.i18nService.translate("newItem"),
        addNewVaultItem: this.i18nService.translate("addNewVaultItem"),
      };
    }

    return this.inlineMenuPageTranslations;
  }

  /**
   * Facilitates redirecting focus out of one of the
   * inline menu elements to elements on the page.
   *
   * @param direction - The direction to redirect focus to (either "next", "previous" or "current)
   * @param sender - The sender of the port message
   */
  private redirectInlineMenuFocusOut(
    { direction }: OverlayPortMessage,
    { sender }: chrome.runtime.Port,
  ) {
    if (!direction) {
      return;
    }

    void BrowserApi.tabSendMessageData(sender.tab, "redirectAutofillInlineMenuFocusOut", {
      direction,
    });
  }

  /**
   * Triggers adding a new vault item from the overlay. Gathers data
   * input by the user before calling to open the add/edit window.
   *
   * @param sender - The sender of the port message
   */
  private getNewVaultItemDetails({ sender }: chrome.runtime.Port) {
    if (!this.senderTabHasFocusedField(sender)) {
      return;
    }

    void BrowserApi.tabSendMessage(
      sender.tab,
      { command: "addNewVaultItemFromOverlay" },
      {
        frameId: this.focusedFieldData.frameId || 0,
      },
    );
  }

  /**
   * Handles adding a new vault item from the overlay. Gathers data login
   * data captured in the extension message.
   *
   * @param login - The login data captured from the extension message
   * @param sender - The sender of the extension message
   */
  private async addNewVaultItem(
    { login }: OverlayAddNewItemMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    if (!login) {
      return;
    }

    this.closeInlineMenu(sender);
    const uriView = new LoginUriView();
    uriView.uri = login.uri;

    const loginView = new LoginView();
    loginView.uris = [uriView];
    loginView.username = login.username || "";
    loginView.password = login.password || "";

    const cipherView = new CipherView();
    cipherView.name = (Utils.getHostname(login.uri) || login.hostname).replace(/^www\./, "");
    cipherView.folderId = null;
    cipherView.type = CipherType.Login;
    cipherView.login = loginView;

    await this.cipherService.setAddEditCipherInfo({
      cipher: cipherView,
      collectionIds: cipherView.collectionIds,
    });

    await this.openAddEditVaultItemPopout(sender.tab, { cipherId: cipherView.id });
    await BrowserApi.sendMessage("inlineAutofillMenuRefreshAddEditCipher");
  }

  /**
   * Updates the property that identifies if a form field set up for the inline menu is currently focused.
   *
   * @param message - The message received from the web page
   */
  private updateIsFieldCurrentlyFocused(message: OverlayBackgroundExtensionMessage) {
    this.isFieldCurrentlyFocused = message.isFieldCurrentlyFocused;
  }

  /**
   * Allows a content script to check if a form field setup for the inline menu is currently focused.
   */
  private checkIsFieldCurrentlyFocused() {
    return this.isFieldCurrentlyFocused;
  }

  /**
   * Updates the property that identifies if a form field is currently being autofilled.
   *
   * @param message - The message received from the web page
   */
  private updateIsFieldCurrentlyFilling(message: OverlayBackgroundExtensionMessage) {
    this.isFieldCurrentlyFilling = message.isFieldCurrentlyFilling;
  }

  /**
   * Allows a content script to check if a form field is currently being autofilled.
   */
  private checkIsFieldCurrentlyFilling() {
    return this.isFieldCurrentlyFilling;
  }

  /**
   * Returns the visibility status of the inline menu button.
   */
  private checkIsInlineMenuButtonVisible(): boolean {
    return this.isInlineMenuButtonVisible;
  }

  /**
   * Returns the visibility status of the inline menu list.
   */
  private checkIsInlineMenuListVisible(): boolean {
    return this.isInlineMenuListVisible;
  }

  /**
   * Responds to the content script's request to check if the inline menu ciphers are populated.
   * This will return true only if the sender is the focused field's tab and the inline menu
   * ciphers are populated.
   *
   * @param sender - The sender of the message
   */
  private checkIsInlineMenuCiphersPopulated(sender: chrome.runtime.MessageSender) {
    return this.senderTabHasFocusedField(sender) && this.inlineMenuCiphers.size > 0;
  }

  /**
   * Triggers an update in the meta "color-scheme" value within the inline menu button.
   * This is done to ensure that the button element has a transparent background, which
   * is accomplished by setting the "color-scheme" meta value of the button iframe to
   * the same value as the page's meta "color-scheme" value.
   */
  private updateInlineMenuButtonColorScheme() {
    this.inlineMenuButtonPort?.postMessage({
      command: "updateAutofillInlineMenuColorScheme",
    });
  }

  /**
   * Triggers an update in the inline menu list's height.
   *
   * @param message - Contains the dimensions of the inline menu list
   */
  private updateInlineMenuListHeight(message: OverlayBackgroundExtensionMessage) {
    this.inlineMenuListPort?.postMessage({
      command: "updateAutofillInlineMenuPosition",
      styles: message.styles,
    });
  }

  /**
   * Handles verifying whether the inline menu should be repositioned. This is used to
   * guard against removing the inline menu when other frames trigger a resize event.
   *
   * @param sender - The sender of the message
   */
  private checkShouldRepositionInlineMenu(sender: chrome.runtime.MessageSender): boolean {
    if (!this.focusedFieldData || !this.senderTabHasFocusedField(sender)) {
      return false;
    }

    if (this.focusedFieldData?.frameId === sender.frameId) {
      return true;
    }

    const subFrameOffsetsForTab = this.subFrameOffsetsForTab[sender.tab.id];
    if (subFrameOffsetsForTab) {
      for (const value of subFrameOffsetsForTab.values()) {
        if (value?.parentFrameIds.includes(sender.frameId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Identifies if the sender tab is the same as the focused field's tab.
   *
   * @param sender - The sender of the message
   */
  private senderTabHasFocusedField(sender: chrome.runtime.MessageSender) {
    return sender.tab.id === this.focusedFieldData?.tabId;
  }

  /**
   * Triggers when a scroll or resize event occurs within a tab. Will reposition the inline menu
   * if the focused field is within the viewport.
   *
   * @param sender - The sender of the message
   */
  private async triggerOverlayReposition(sender: chrome.runtime.MessageSender) {
    if (!this.checkShouldRepositionInlineMenu(sender)) {
      return;
    }

    this.resetFocusedFieldSubFrameOffsets(sender);
    this.cancelInlineMenuFadeInAndPositionUpdate();
    void this.toggleInlineMenuHidden({ isInlineMenuHidden: true }, sender);
    this.repositionInlineMenuSubject.next(sender);
  }

  /**
   * Sets the sub frame offsets for the currently focused field's frame to a null value .
   * This ensures that we can delay presentation of the inline menu after a reposition
   * event if the user clicks on a field before the sub frames can be rebuilt.
   *
   * @param sender
   */
  private resetFocusedFieldSubFrameOffsets(sender: chrome.runtime.MessageSender) {
    if (this.focusedFieldData.frameId > 0 && this.subFrameOffsetsForTab[sender.tab.id]) {
      this.subFrameOffsetsForTab[sender.tab.id].set(this.focusedFieldData.frameId, null);
    }
  }

  /**
   * Triggers when a focus event occurs within a tab. Will reposition the inline menu
   * if the focused field is within the viewport.
   *
   * @param sender - The sender of the message
   */
  private async triggerSubFrameFocusInRebuild(sender: chrome.runtime.MessageSender) {
    this.cancelInlineMenuFadeInAndPositionUpdate();
    this.rebuildSubFrameOffsetsSubject.next(sender);
    this.repositionInlineMenuSubject.next(sender);
  }

  /**
   * Handles determining if the inline menu should be repositioned or closed, and initiates
   * the process of calculating the new position of the inline menu.
   *
   * @param sender - The sender of the message
   */
  private repositionInlineMenu = async (sender: chrome.runtime.MessageSender) => {
    this.cancelInlineMenuFadeInAndPositionUpdate();
    if (!this.isFieldCurrentlyFocused && !this.isInlineMenuButtonVisible) {
      await this.closeInlineMenuAfterReposition(sender);
      return;
    }

    const isFieldWithinViewport = await BrowserApi.tabSendMessage(
      sender.tab,
      { command: "checkIsMostRecentlyFocusedFieldWithinViewport" },
      { frameId: this.focusedFieldData.frameId },
    );
    if (!isFieldWithinViewport) {
      await this.closeInlineMenuAfterReposition(sender);
      return;
    }

    if (this.focusedFieldData.frameId > 0) {
      this.rebuildSubFrameOffsetsSubject.next(sender);
    }

    this.startUpdateInlineMenuPositionSubject.next(sender);
  };

  /**
   * Triggers a closure of the inline menu during a reposition event.
   *
   * @param sender - The sender of the message
|   */
  private async closeInlineMenuAfterReposition(sender: chrome.runtime.MessageSender) {
    await this.toggleInlineMenuHidden(
      { isInlineMenuHidden: false, setTransparentInlineMenu: true },
      sender,
    );
    this.closeInlineMenu(sender, { forceCloseInlineMenu: true });
  }

  /**
   * Cancels the observables that update the position and fade in of the inline menu.
   */
  private cancelInlineMenuFadeInAndPositionUpdate() {
    this.cancelInlineMenuFadeIn();
    this.cancelUpdateInlineMenuPositionSubject.next();
  }

  /**
   * Sets up the extension message listeners for the overlay.
   */
  private setupExtensionListeners() {
    BrowserApi.messageListener("overlay.background", this.handleExtensionMessage);
    BrowserApi.addListener(chrome.webNavigation.onCommitted, this.handleWebNavigationOnCommitted);
    BrowserApi.addListener(chrome.runtime.onConnect, this.handlePortOnConnect);
  }

  /**
   * Handles extension messages sent to the extension background.
   *
   * @param message - The message received from the extension
   * @param sender - The sender of the message
   * @param sendResponse - The response to send back to the sender
   */
  private handleExtensionMessage = (
    message: OverlayBackgroundExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ) => {
    const handler: CallableFunction | undefined = this.extensionMessageHandlers[message?.command];
    if (!handler) {
      return null;
    }

    const messageResponse = handler({ message, sender });
    if (typeof messageResponse === "undefined") {
      return null;
    }

    Promise.resolve(messageResponse)
      .then((response) => sendResponse(response))
      .catch(this.logService.error);
    return true;
  };

  /**
   * Handles clearing page details and sub frame offsets when a frame or tab navigation event occurs.
   *
   * @param details - The details of the web navigation event
   */
  private handleWebNavigationOnCommitted = (
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
  ) => {
    const { frameId, tabId } = details;
    const subFrames = this.subFrameOffsetsForTab[tabId];
    if (frameId === 0) {
      this.removePageDetails(tabId);
      if (subFrames) {
        subFrames.clear();
        delete this.subFrameOffsetsForTab[tabId];
      }
      return;
    }

    if (subFrames && subFrames.has(frameId)) {
      subFrames.delete(frameId);
    }
  };

  /**
   * Handles the connection of a port to the extension background.
   *
   * @param port - The port that connected to the extension background
   */
  private handlePortOnConnect = async (port: chrome.runtime.Port) => {
    const isInlineMenuListMessageConnector = port.name === AutofillOverlayPort.ListMessageConnector;
    const isInlineMenuButtonMessageConnector =
      port.name === AutofillOverlayPort.ButtonMessageConnector;
    if (isInlineMenuListMessageConnector || isInlineMenuButtonMessageConnector) {
      port.onMessage.addListener(this.handleOverlayElementPortMessage);
      return;
    }

    const isInlineMenuListPort = port.name === AutofillOverlayPort.List;
    const isInlineMenuButtonPort = port.name === AutofillOverlayPort.Button;
    if (!isInlineMenuListPort && !isInlineMenuButtonPort) {
      return;
    }

    if (!this.portKeyForTab[port.sender.tab.id]) {
      this.portKeyForTab[port.sender.tab.id] = generateRandomChars(12);
    }

    this.storeOverlayPort(port);
    port.onDisconnect.addListener(this.handlePortOnDisconnect);
    port.onMessage.addListener(this.handleOverlayElementPortMessage);
    port.postMessage({
      command: `initAutofillInlineMenu${isInlineMenuListPort ? "List" : "Button"}`,
      iframeUrl: chrome.runtime.getURL(
        `overlay/menu-${isInlineMenuListPort ? "list" : "button"}.html`,
      ),
      pageTitle: chrome.i18n.getMessage(
        isInlineMenuListPort ? "bitwardenVault" : "bitwardenOverlayButton",
      ),
      authStatus: await this.getAuthStatus(),
      styleSheetUrl: chrome.runtime.getURL(
        `overlay/menu-${isInlineMenuListPort ? "list" : "button"}.css`,
      ),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      translations: this.getInlineMenuTranslations(),
      ciphers: isInlineMenuListPort ? await this.getInlineMenuCipherData() : null,
      portKey: this.portKeyForTab[port.sender.tab.id],
      portName: isInlineMenuListPort
        ? AutofillOverlayPort.ListMessageConnector
        : AutofillOverlayPort.ButtonMessageConnector,
    });
    void this.updateInlineMenuPosition(
      {
        overlayElement: isInlineMenuListPort
          ? AutofillOverlayElement.List
          : AutofillOverlayElement.Button,
      },
      port.sender,
    );
  };

  /**
   * Stores the connected overlay port and sets up any existing ports to be disconnected.
   *
   * @param port - The port to store
|   */
  private storeOverlayPort(port: chrome.runtime.Port) {
    if (port.name === AutofillOverlayPort.List) {
      this.storeExpiredOverlayPort(this.inlineMenuListPort);
      this.inlineMenuListPort = port;
      return;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.storeExpiredOverlayPort(this.inlineMenuButtonPort);
      this.inlineMenuButtonPort = port;
    }
  }

  /**
   * When registering a new connection, we want to ensure that the port is disconnected.
   * This method places an existing port in the expiredPorts array to be disconnected
   * at a later time.
   *
   * @param port - The port to store in the expiredPorts array
   */
  private storeExpiredOverlayPort(port: chrome.runtime.Port | null) {
    if (port) {
      this.expiredPorts.push(port);
    }
  }

  /**
   * Handles messages sent to the overlay list or button ports.
   *
   * @param message - The message received from the port
   * @param port - The port that sent the message
   */
  private handleOverlayElementPortMessage = (
    message: OverlayBackgroundExtensionMessage,
    port: chrome.runtime.Port,
  ) => {
    const tabPortKey = this.portKeyForTab[port.sender.tab.id];
    if (!tabPortKey || tabPortKey !== message?.portKey) {
      return;
    }

    const command = message.command;
    let handler: CallableFunction | undefined;

    if (port.name === AutofillOverlayPort.ButtonMessageConnector) {
      handler = this.inlineMenuButtonPortMessageHandlers[command];
    }

    if (port.name === AutofillOverlayPort.ListMessageConnector) {
      handler = this.inlineMenuListPortMessageHandlers[command];
    }

    if (!handler) {
      return;
    }

    handler({ message, port });
  };

  /**
   * Ensures that the inline menu list and button port
   * references are reset when they are disconnected.
   *
   * @param port - The port that was disconnected
   */
  private handlePortOnDisconnect = (port: chrome.runtime.Port) => {
    if (port.name === AutofillOverlayPort.List) {
      this.inlineMenuListPort = null;
      this.isInlineMenuListVisible = false;
    }

    if (port.name === AutofillOverlayPort.Button) {
      this.inlineMenuButtonPort = null;
      this.isInlineMenuButtonVisible = false;
    }
  };
}
