import { any, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { trackEmissions } from "../../../../spec";
import { FakeStorageService } from "../../../../spec/fake-storage.service";
import { AccountInfo, AccountService } from "../../../auth/abstractions/account.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { UserId } from "../../../types/guid";
import { KeyDefinition } from "../key-definition";
import { StateDefinition } from "../state-definition";

import { DefaultUserStateProvider } from "./default-user-state.provider";

class TestState {
  date: Date;
  array: string[];

  static fromJSON(jsonState: Jsonify<TestState>) {
    if (jsonState == null) {
      return null;
    }

    return Object.assign(new TestState(), jsonState, {
      date: new Date(jsonState.date),
    });
  }
}

const testStateDefinition = new StateDefinition("fake", "disk");

const testKeyDefinition = new KeyDefinition<TestState>(
  testStateDefinition,
  "fake",
  TestState.fromJSON
);

// TODO this class needs to be totally retested, it doesn't work like this anymore
describe("DefaultStateProvider", () => {
  const accountService = mock<AccountService>();
  let diskStorageService: FakeStorageService;

  const activeAccountSubject = new BehaviorSubject<{ id: UserId } & AccountInfo>(undefined);

  let userStateProvider: DefaultUserStateProvider;

  beforeEach(() => {
    accountService.activeAccount$ = activeAccountSubject;

    diskStorageService = new FakeStorageService();
    userStateProvider = new DefaultUserStateProvider(
      accountService,
      null, // Not testing derived state
      null, // Not testing memory storage
      diskStorageService,
      null // Not testing secure storage
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("createUserState", async () => {
    diskStorageService.internalUpdateStore({
      fake_1_fake: {
        date: "2022-09-21T13:14:17.648Z",
        array: ["value1", "value2"],
      } as Jsonify<TestState>,
      fake_2_fake: {
        date: "2021-09-21T13:14:17.648Z",
        array: ["user2_value"],
      },
    });

    const fakeDomainState = userStateProvider.get(testKeyDefinition);

    const emissions = trackEmissions(fakeDomainState.state$);

    // User signs in
    activeAccountSubject.next({
      id: "1" as UserId,
      email: "useremail",
      name: "username",
      status: AuthenticationStatus.Unlocked,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    // Service does an update
    await fakeDomainState.update((state) => {
      state.array.push("value3");
      state.date = new Date(2023, 0);
      return state;
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    // Emulate an account switch
    activeAccountSubject.next({
      id: "2" as UserId,
      email: "second_email@example.com",
      name: "User #2",
      status: AuthenticationStatus.Unlocked,
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 1));

    expect(emissions).toHaveLength(3);
    // Gotten starter user data
    expect(emissions[0]).toBeTruthy();
    expect(emissions[0].array).toHaveLength(2);

    // Gotten emission for the update call
    expect(emissions[1]).toBeTruthy();
    expect(emissions[1].array).toHaveLength(3);
    expect(new Date(emissions[1].date).getUTCFullYear()).toBe(2023);

    // The second users data
    expect(emissions[2]).toBeTruthy();
    expect(emissions[2].array).toHaveLength(1);
    expect(new Date(emissions[2].date).getUTCFullYear()).toBe(2021);

    // Should only be called twice to get state, once for each user
    expect(diskStorageService.mock.get).toHaveBeenCalledTimes(2);
    expect(diskStorageService.mock.get).toHaveBeenNthCalledWith(1, "fake_1_fake", any());
    expect(diskStorageService.mock.get).toHaveBeenNthCalledWith(2, "fake_2_fake", any());

    // Should only have saved data for the first user
    expect(diskStorageService.mock.save).toHaveBeenCalledTimes(1);
    expect(diskStorageService.mock.save).toHaveBeenNthCalledWith(1, "fake_1_fake", any());
  });
});
