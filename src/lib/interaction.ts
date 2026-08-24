import type { PixelRect, Point } from "./types";
import { rectFromCells } from "./rect";

export type BoardMode = "explore" | "select";
export type InteractionPhase = "idle" | "panning" | "selecting" | "pinching";

export type InteractionState = {
  phase: InteractionPhase;
  mode: BoardMode;
  pointerId: number | null;
  origin: Point | null;
  last: Point | null;
  selectionOrigin: Point | null;
  selection: PixelRect | null;
  moved: boolean;
};

export type InteractionAction =
  | { type: "set_mode"; mode: BoardMode }
  | { type: "pointer_down"; pointerId: number; screen: Point; cell: Point; pan: boolean }
  | { type: "pointer_move"; pointerId: number; screen: Point; cell: Point; dragThreshold?: number }
  | { type: "pointer_up"; pointerId: number }
  | { type: "pinch_start" }
  | { type: "cancel" }
  | { type: "set_selection"; selection: PixelRect | null };

export function initialInteractionState(mode: BoardMode = "explore"): InteractionState {
  return {
    phase: "idle",
    mode,
    pointerId: null,
    origin: null,
    last: null,
    selectionOrigin: null,
    selection: null,
    moved: false,
  };
}

export function interactionReducer(
  state: InteractionState,
  action: InteractionAction,
): InteractionState {
  switch (action.type) {
    case "set_mode":
      return {
        ...initialInteractionState(action.mode),
        selection: state.selection,
      };
    case "pointer_down": {
      const phase = action.pan || state.mode === "explore" ? "panning" : "selecting";
      return {
        ...state,
        phase,
        pointerId: action.pointerId,
        origin: action.screen,
        last: action.screen,
        selectionOrigin: phase === "selecting" ? action.cell : null,
        selection: phase === "selecting" ? rectFromCells(action.cell, action.cell) : state.selection,
        moved: false,
      };
    }
    case "pointer_move": {
      if (state.pointerId !== action.pointerId || !state.origin) {
        return state;
      }
      const threshold = action.dragThreshold ?? 5;
      const distance = Math.hypot(
        action.screen.x - state.origin.x,
        action.screen.y - state.origin.y,
      );
      return {
        ...state,
        last: action.screen,
        moved: state.moved || distance >= threshold,
        selection:
          state.phase === "selecting" && state.selectionOrigin
            ? rectFromCells(state.selectionOrigin, action.cell)
            : state.selection,
      };
    }
    case "pointer_up":
      if (state.pointerId !== action.pointerId) return state;
      return {
        ...state,
        phase: "idle",
        pointerId: null,
        origin: null,
        last: null,
        selectionOrigin: null,
      };
    case "pinch_start":
      return {
        ...state,
        phase: "pinching",
        pointerId: null,
        origin: null,
        last: null,
        selectionOrigin: null,
        moved: true,
      };
    case "cancel":
      return {
        ...initialInteractionState(state.mode),
        selection: null,
      };
    case "set_selection":
      return {
        ...state,
        selection: action.selection,
      };
  }
}
