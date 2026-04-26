import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";
import type { RootState, AppDispatch } from "@/store";

/**
 * Typed version of useDispatch — use this throughout the app instead of
 * the plain useDispatch hook so thunk types are inferred correctly.
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Typed version of useSelector — use this throughout the app instead of
 * the plain useSelector hook so the RootState type is inferred correctly.
 * Uses RTK's TypedUseSelectorHook to preserve all useSelector overloads
 * (including the optional equality function parameter).
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
