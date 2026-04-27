import { describe, it, expect } from "vitest";
import lobbiesReducer from "../slice";
import type { LobbiesState } from "../slice";
import { selectLobbyById, selectLobbyList } from "../selectors";
import type { RootState } from "@/store";
import type { Lobby } from "@/lib/api/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeLobby = (id: string, name: string): Lobby => ({
  id,
  name,
  accessibility: "PUBLIC",
  organizer: { id: "organizer-id", type: "human" },
  players: [],
  invitees: [],
});

const LOBBY_A = makeLobby("lobby-a", "Lobby Alpha");
const LOBBY_B = makeLobby("lobby-b", "Lobby Beta");
const LOBBY_C = makeLobby("lobby-c", "Lobby Gamma");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(lobbiesState: Partial<LobbiesState> = {}): RootState {
  const lobbies: LobbiesState = {
    byId: {},
    list: [],
    loading: {},
    listLoading: false,
    errors: {},
    listError: null,
    actionInFlight: {},
    ...lobbiesState,
  };
  // Cast: only the lobbies slice is needed for these tests
  return { lobbies } as unknown as RootState;
}

// ─── Reducer tests ────────────────────────────────────────────────────────────

describe("lobbiesSlice reducer", () => {
  it("initializes to empty state with all fields present", () => {
    const state = lobbiesReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual({
      byId: {},
      list: [],
      loading: {},
      listLoading: false,
      errors: {},
      listError: null,
      actionInFlight: {},
    });
  });
});

// ─── Selector tests ───────────────────────────────────────────────────────────

describe("selectLobbyById", () => {
  it("returns the lobby when present", () => {
    const state = makeState({ byId: { [LOBBY_A.id]: LOBBY_A } });
    expect(selectLobbyById(state, LOBBY_A.id)).toEqual(LOBBY_A);
  });

  it("returns undefined when lobby is not in cache", () => {
    const state = makeState();
    expect(selectLobbyById(state, "missing-lobby")).toBeUndefined();
  });
});

describe("selectLobbyList", () => {
  it("returns [] when list is empty", () => {
    const state = makeState();
    expect(selectLobbyList(state)).toEqual([]);
  });

  it("returns lobbies in the exact order of list IDs", () => {
    const state = makeState({
      byId: {
        [LOBBY_A.id]: LOBBY_A,
        [LOBBY_B.id]: LOBBY_B,
        [LOBBY_C.id]: LOBBY_C,
      },
      list: [LOBBY_C.id, LOBBY_A.id, LOBBY_B.id],
    });
    expect(selectLobbyList(state)).toEqual([LOBBY_C, LOBBY_A, LOBBY_B]);
  });

  it("skips lobby IDs not present in byId", () => {
    const state = makeState({
      byId: { [LOBBY_A.id]: LOBBY_A, [LOBBY_C.id]: LOBBY_C },
      list: [LOBBY_A.id, LOBBY_B.id, LOBBY_C.id], // LOBBY_B missing from byId
    });
    expect(selectLobbyList(state)).toEqual([LOBBY_A, LOBBY_C]);
  });

  it("returns referentially stable result across no-op state updates", () => {
    const state = makeState({
      byId: { [LOBBY_A.id]: LOBBY_A },
      list: [LOBBY_A.id],
    });

    const first = selectLobbyList(state);
    const second = selectLobbyList(state);

    expect(first).toBe(second);
  });
});
