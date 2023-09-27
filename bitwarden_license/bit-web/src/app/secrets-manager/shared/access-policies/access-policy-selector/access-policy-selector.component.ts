import { Component, forwardRef, Input, OnDestroy, OnInit } from "@angular/core";
import {
  ControlValueAccessor,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
} from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { ControlsOf } from "@bitwarden/angular/types/controls-of";
import { FormSelectionList } from "@bitwarden/angular/utils/form-selection-list";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SelectItemView } from "@bitwarden/components";

import {
  AccessPolicyItemView,
  AccessPolicyItemValue,
  AccessPolicyPermission,
  AccessPolicyItemType,
} from "./access-policy-selector.models";

@Component({
  selector: "sm-access-policy-selector",
  templateUrl: "access-policy-selector.component.html",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AccessPolicySelectorComponent),
      multi: true,
    },
  ],
})
export class AccessPolicySelectorComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private notifyOnChange: (v: unknown) => void;
  private notifyOnTouch: () => void;
  private pauseChangeNotification: boolean;

  protected permissionList = [
    { perm: AccessPolicyPermission.CanRead, labelId: "canRead" },
    { perm: AccessPolicyPermission.CanReadWrite, labelId: "canReadWrite" },
  ];
  private initialPermission = AccessPolicyPermission.CanRead;

  /**
   * The internal selection list that tracks the value of this form control / component.
   * It's responsible for keeping items sorted and synced with the rendered form controls
   * @protected
   */
  protected selectionList = new FormSelectionList<AccessPolicyItemView, AccessPolicyItemValue>(
    (item) => {
      const permissionControl = this.formBuilder.control(this.initialPermission);
      let currentUserInGroup = false;
      let currentUser = false;
      if (item.type == AccessPolicyItemType.Group) {
        currentUserInGroup = item.currentUserInGroup;
      }
      if (item.type == AccessPolicyItemType.User) {
        currentUser = item.currentUser;
      }
      const fg = this.formBuilder.group<ControlsOf<AccessPolicyItemValue>>({
        id: new FormControl(item.id),
        type: new FormControl(item.type),
        permission: permissionControl,
        currentUserInGroup: new FormControl(currentUserInGroup),
        currentUser: new FormControl(currentUser),
      });

      return fg;
    },
    this._itemComparator.bind(this)
  );

  /**
   * Internal form group for this component.
   * @protected
   */
  protected formGroup = this.formBuilder.group({
    items: this.selectionList.formArray,
  });

  protected multiSelectFormGroup = new FormGroup({
    multiSelect: new FormControl([]),
  });

  disabled: boolean;

  @Input() loading: boolean;
  @Input() addButtonMode: boolean;
  @Input() label: string;
  @Input() hint: string;
  @Input() columnTitle: string;
  @Input() emptyMessage: string;

  @Input()
  get items(): AccessPolicyItemView[] {
    return this.selectionList.allItems;
  }

  set items(val: AccessPolicyItemView[]) {
    if (val != null) {
      const selected = this.selectionList.formArray.getRawValue() ?? [];
      this.selectionList.populateItems(
        val.map((m) => {
          m.icon = m.icon ?? this.itemIcon(m);
          return m;
        }),
        selected
      );
    }
  }

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService
  ) {}

  /** Required for NG_VALUE_ACCESSOR */
  registerOnChange(fn: any): void {
    this.notifyOnChange = fn;
  }

  /** Required for NG_VALUE_ACCESSOR */
  registerOnTouched(fn: any): void {
    this.notifyOnTouch = fn;
  }

  /** Required for NG_VALUE_ACCESSOR */
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;

    // Keep the internal FormGroup in sync
    if (this.disabled) {
      this.formGroup.disable();
      this.multiSelectFormGroup.disable();
    } else {
      this.formGroup.enable();
      this.multiSelectFormGroup.enable();
    }
  }

  /** Required for NG_VALUE_ACCESSOR */
  writeValue(selectedItems: AccessPolicyItemValue[]): void {
    // Modifying the selection list, mistakenly fires valueChanges in the
    // internal form array, so we need to know to pause external notification
    this.pauseChangeNotification = true;

    // Always clear the internal selection list on a new value
    this.selectionList.deselectAll();

    // If the new value is null, then we're done
    if (selectedItems == null) {
      this.pauseChangeNotification = false;
      return;
    }

    // Unable to handle other value types, throw
    if (!Array.isArray(selectedItems)) {
      throw new Error("The access selector component only supports Array form values!");
    }

    // Iterate and internally select each item
    for (const value of selectedItems) {
      this.selectionList.selectItem(value.id, value);
    }

    this.pauseChangeNotification = false;
  }

  ngOnInit() {
    // Watch the internal formArray for changes and propagate them
    this.selectionList.formArray.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((v) => {
      if (!this.notifyOnChange || this.pauseChangeNotification) {
        return;
      }

      // Disabled form arrays emit values for disabled controls, we override this to emit an empty array to avoid
      // emitting values for disabled controls that are "readonly" in the table
      if (this.selectionList.formArray.disabled) {
        this.notifyOnChange([]);
        return;
      }
      this.notifyOnChange(v);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected handleBlur() {
    if (!this.notifyOnTouch) {
      return;
    }

    this.notifyOnTouch();
  }

  protected selectItems(items: SelectItemView[]) {
    this.pauseChangeNotification = true;
    this.selectionList.selectItems(items.map((i) => i.id));
    this.pauseChangeNotification = false;
    if (this.notifyOnChange != undefined) {
      this.notifyOnChange(this.selectionList.formArray.value);
    }
  }

  protected addButton() {
    this.selectItems(this.multiSelectFormGroup.value.multiSelect);
    this.multiSelectFormGroup.reset();
  }

  private itemIcon(item: AccessPolicyItemView) {
    switch (item.type) {
      case AccessPolicyItemType.User:
        return "bwi-user";
      case AccessPolicyItemType.Group:
        return "bwi-family";
      case AccessPolicyItemType.ServiceAccount:
        return "bwi-wrench";
      case AccessPolicyItemType.Project:
        return "bwi-collection";
    }
  }

  private _itemComparator(a: AccessPolicyItemView, b: AccessPolicyItemView) {
    return (
      a.type - b.type ||
      this.i18nService.collator.compare(a.listName, b.listName) ||
      this.i18nService.collator.compare(a.labelName, b.labelName)
    );
  }
}