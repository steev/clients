import {
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  Output,
} from "@angular/core";
import { Router } from "@angular/router";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";

import { GroupView } from "../../../admin-console/organizations/core";
import { CollectionAdminView } from "../../core/views/collection-admin.view";

import { VaultItemEvent } from "./vault-item-event";
import { RowHeightClass } from "./vault-items.component";

@Component({
  selector: "tr[appVaultCollectionRow]",
  templateUrl: "vault-collection-row.component.html",
})
export class VaultCollectionRowComponent implements OnInit {
  protected RowHeightClass = RowHeightClass;

  @Input() disabled: boolean;
  @Input() collection: CollectionView;
  @Input() showOwner: boolean;
  @Input() showCollections: boolean;
  @Input() showGroups: boolean;
  @Input() canEditCollection: boolean;
  @Input() canDeleteCollection: boolean;
  @Input() organizations: Organization[];
  @Input() groups: GroupView[];
  @Input() orgVault: boolean;
  permissionText: string;

  @Output() onEvent = new EventEmitter<VaultItemEvent>();

  @Input() checked: boolean;
  @Output() checkedToggled = new EventEmitter<void>();

  constructor(private router: Router) {}

  ngOnInit() {
    if (this.collection.manage) {
      this.permissionText = "canManage";
    } else if (!this.collection.readOnly) {
      this.permissionText = "canEdit";
    } else if (this.collection.readOnly) {
      this.permissionText = "canView";
    } else {
      this.permissionText = null;
    }
  }

  @HostBinding("class")
  get classes() {
    return [].concat(this.disabled ? [] : ["tw-cursor-pointer"]);
  }

  get collectionGroups() {
    if (!(this.collection instanceof CollectionAdminView)) {
      return [];
    }

    return this.collection.groups;
  }

  get organization() {
    return this.organizations.find((o) => o.id === this.collection.organizationId);
  }

  @HostListener("click")
  protected click() {
    this.router.navigate([], {
      queryParams: { collectionId: this.collection.id },
      queryParamsHandling: "merge",
    });
  }

  protected edit() {
    this.onEvent.next({ type: "editCollection", item: this.collection });
  }

  protected access() {
    this.onEvent.next({ type: "viewCollectionAccess", item: this.collection });
  }

  protected deleteCollection() {
    this.onEvent.next({ type: "delete", items: [{ collection: this.collection }] });
  }
}
