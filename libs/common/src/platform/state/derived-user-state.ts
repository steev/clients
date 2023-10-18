import { Observable, switchMap } from "rxjs";

import { EncryptService } from "../abstractions/encrypt.service";

import { DerivedStateDefinition, DeriveContext } from "./derived-state-definition";
import { UserState } from "./user-state";

export class DerivedUserState<TFrom, TTo> {
  state$: Observable<TTo>;

  constructor(
    private derivedStateDefinition: DerivedStateDefinition<TFrom, TTo>,
    private encryptService: EncryptService,
    private userState: UserState<TFrom>
  ) {
    this.state$ = userState.state$.pipe(
      switchMap(async (from) => {
        // TODO: How do I get the key?
        const convertedData = await derivedStateDefinition.converter(
          from,
          new DeriveContext(null, encryptService)
        );
        return convertedData;
      })
    );
  }

  async getFromState(): Promise<TTo> {
    const encryptedFromState = await this.userState.getFromState();

    const context = new DeriveContext(null, this.encryptService);

    const decryptedData = await this.derivedStateDefinition.converter(encryptedFromState, context);
    return decryptedData;
  }
}
