import { useCallback, useEffect, useRef, useState } from "react";

interface UsePollingOptions<T> {
  fetcher: () => Promise<T>;
  interval?: number;
  enabled?: boolean;
}

interface UsePollingResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  isStale: boolean;
  refetch: () => Promise<void>;
}

const DEFAULT_INTERVAL = 3000;
const MAX_BACKOFF = 30000;

export function usePolling<T>({
  fetcher,
  interval = DEFAULT_INTERVAL,
  enabled = true,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);

  const failureCount = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetcherRef = useRef(fetcher);

  // Update fetcher ref in an effect to avoid ref writes during render
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const poll = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setIsStale(false);
      failureCount.current = 0;
    } catch (e) {
      failureCount.current += 1;
      setError(e instanceof Error ? e : new Error(String(e)));
      setIsStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling loop
  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    let cancelled = false;

    function scheduleNext() {
      if (cancelled) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const backoff = Math.min(
        interval * Math.pow(2, failureCount.current),
        MAX_BACKOFF,
      );
      const delay = failureCount.current > 0 ? backoff : interval;
      timeoutRef.current = setTimeout(async () => {
        if (cancelled) return;
        await poll();
        scheduleNext();
      }, delay);
    }

    poll().then(() => {
      if (!cancelled) scheduleNext();
    });

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enabled, poll, interval]);

  // Re-poll on tab focus
  useEffect(() => {
    if (!enabled) return;

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        poll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, poll]);

  // Re-poll on network recovery
  useEffect(() => {
    if (!enabled) return;

    function handleOnline() {
      poll();
    }

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [enabled, poll]);

  const refetch = useCallback(async () => {
    await poll();
  }, [poll]);

  return { data, loading, error, isStale, refetch };
}
