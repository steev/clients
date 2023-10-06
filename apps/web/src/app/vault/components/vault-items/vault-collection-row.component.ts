import {
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  Output,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
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

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {}

  // we will have more permissions when this PR is merged
  // https://github.com/bitwarden/clients/pull/6417

  ngOnInit() {
    // change this to use new collection data
    if (
      this.organizations[0].type === OrganizationUserType.Owner ||
      this.organizations[0].type === OrganizationUserType.Manager
    ) {
      this.permissionText = "canManage"; // how to bring this from json. maybe set the json key
    } else if (this.organizations[0].type === OrganizationUserType.Admin) {
      this.permissionText = "canEdit";
    } else {
      this.permissionText = "-";
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
