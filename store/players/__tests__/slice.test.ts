import { describe, it, expect } from "vitest";
import playersReducer, { playersUpserted } from "../slice";
import type { PlayersState } from "../slice";
import { selectPlayerById, selectPlayersByIds } from "../selectors";
import type { RootState } from "@/store";
import type { Player } from "@/lib/api/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PLAYER_A: Player = { id: "player-a", name: "Alice", pictureUrl: null };
const PLAYER_B: Player = { id: "player-b", name: "Bob", pictureUrl: null };
const PLAYER_C: Player = { id: "player-c", name: "Carol", pictureUrl: null };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(playersState: Partial<PlayersState> = {}): RootState {
  const players: PlayersState = {
    byId: {},
    ...playersState,
  };
  // Cast: only the players slice is needed for these tests
  return { players } as unknown as RootState;
}

// ─── Reducer tests ────────────────────────────────────────────────────────────

describe("playersSlice reducer", () => {
  it("playersUpserted populates byId", () => {
    const state = playersReducer(
      undefined,
      playersUpserted({ players: [PLAYER_A, PLAYER_B] }),
    );
    expect(state.byId[PLAYER_A.id]).toEqual(PLAYER_A);
    expect(state.byId[PLAYER_B.id]).toEqual(PLAYER_B);
  });

  it("playersUpserted with overlapping IDs replaces existing entries (last-write-wins)", () => {
    const initial = playersReducer(
      undefined,
      playersUpserted({ players: [PLAYER_A] }),
    );

    const updated: Player = { ...PLAYER_A, name: "Alice Updated" };
    const state = playersReducer(
      initial,
      playersUpserted({ players: [updated, PLAYER_B] }),
    );

    expect(state.byId[PLAYER_A.id]).toEqual(updated);
    expect(state.byId[PLAYER_B.id]).toEqual(PLAYER_B);
  });
});

// ─── Selector tests ───────────────────────────────────────────────────────────

describe("selectPlayerById", () => {
  it("returns the player when present", () => {
    const state = makeState({ byId: { [PLAYER_A.id]: PLAYER_A } });
    expect(selectPlayerById(state, PLAYER_A.id)).toEqual(PLAYER_A);
  });

  it("returns undefined when player is not in cache", () => {
    const state = makeState();
    expect(selectPlayerById(state, "missing-id")).toBeUndefined();
  });
});

describe("selectPlayersByIds", () => {
  it("returns players in input-ID order", () => {
    const state = makeState({
      byId: {
        [PLAYER_A.id]: PLAYER_A,
        [PLAYER_B.id]: PLAYER_B,
        [PLAYER_C.id]: PLAYER_C,
      },
    });
    const result = selectPlayersByIds(state, [
      PLAYER_C.id,
      PLAYER_A.id,
      PLAYER_B.id,
    ]);
    expect(result).toEqual([PLAYER_C, PLAYER_A, PLAYER_B]);
  });

  it("skips IDs missing from cache — no undefined holes, no throw", () => {
    const state = makeState({ byId: { [PLAYER_A.id]: PLAYER_A } });
    const result = selectPlayersByIds(state, [
      PLAYER_A.id,
      "missing-id",
      PLAYER_B.id,
    ]);
    expect(result).toEqual([PLAYER_A]);
  });

  it("returns referentially equal result when called twice with same state and same array reference", () => {
    const state = makeState({ byId: { [PLAYER_A.id]: PLAYER_A } });
    const ids = [PLAYER_A.id];

    const first = selectPlayersByIds(state, ids);
    const second = selectPlayersByIds(state, ids);

    expect(first).toBe(second);
  });

  it("recomputes (different reference) when called with a freshly-constructed but equal-valued array (size-1 cache contract)", () => {
    const state = makeState({ byId: { [PLAYER_A.id]: PLAYER_A } });

    const first = selectPlayersByIds(state, [PLAYER_A.id]);
    const second = selectPlayersByIds(state, [PLAYER_A.id]); // new array, same content

    // createSelector's size-1 cache sees a different `ids` reference → recomputes
    expect(first).not.toBe(second);
  });
});
