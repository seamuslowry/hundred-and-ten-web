/**
 * Detects RTK's `ConditionError` thrown by `.unwrap()` when an async thunk's
 * `condition` callback returns false (concurrency dedup).
 *
 * RTK throws a plain object — `{ name: 'ConditionError', message: '...' }` —
 * not an `Error` instance, so `instanceof Error` does not match. The discriminator
 * is `e.name === 'ConditionError'`.
 *
 * Use in async action handlers to silently bail out on dedup-cancelled dispatches:
 *
 * ```ts
 * try {
 *   await dispatch(someThunk(...)).unwrap();
 * } catch (e) {
 *   if (isConditionError(e)) return;
 *   setActionError(messageFromRejection(e, "Action failed"));
 * }
 * ```
 */
export function isConditionError(
  e: unknown,
): e is { name: "ConditionError"; message?: string } {
  return (
    e != null &&
    typeof e === "object" &&
    (e as { name?: string }).name === "ConditionError"
  );
}

/**
 * Extracts a user-facing message from an RTK rejected-thunk value.
 *
 * `.unwrap()` may throw:
 * - an `Error` instance (uncaught throw inside the thunk body)
 * - a plain string (when the thunk used `rejectWithValue(message)`)
 * - any other value
 *
 * Returns the most informative string available, falling back to the supplied
 * default when none of the known shapes match.
 */
export function messageFromRejection(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
