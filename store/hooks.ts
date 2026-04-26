import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store";

/**
 * Typed version of useDispatch — use this throughout the app instead of
 * the plain useDispatch hook so thunk types are inferred correctly.
 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/**
 * Typed version of useSelector — use this throughout the app instead of
 * the plain useSelector hook so the RootState type is inferred correctly.
 */
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector);
