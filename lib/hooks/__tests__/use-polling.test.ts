import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { usePolling } from "../use-polling";

describe("usePolling", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches data on mount", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    const { result } = renderHook(() =>
      usePolling({ fetcher, interval: 3000 }),
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: 1 });
    expect(result.current.error).toBeNull();
    expect(result.current.isStale).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("polls at the specified interval", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    renderHook(() => usePolling({ fetcher, interval: 3000 }));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it("sets isStale and error on failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      usePolling({ fetcher, interval: 3000 }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isStale).toBe(true);
    expect(result.current.error?.message).toBe("Network error");
  });

  it("applies exponential backoff on failure", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue({ id: 1 });

    renderHook(() => usePolling({ fetcher, interval: 3000 }));

    // Initial fetch (failure 1)
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    // After first failure, backoff = 3000 * 2^1 = 6000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    // Shouldn't have polled yet (backoff is 6s)
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    // Now at 6s total, should poll
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it("does not poll when disabled", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    renderHook(() => usePolling({ fetcher, interval: 3000, enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("re-polls on visibility change", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    renderHook(() => usePolling({ fetcher, interval: 3000 }));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it("re-polls on online event", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    renderHook(() => usePolling({ fetcher, interval: 3000 }));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  it("refetch triggers immediate poll", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce({ id: 2 });

    const { result } = renderHook(() =>
      usePolling({ fetcher, interval: 3000 }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toEqual({ id: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("changing interval mid-lifecycle restarts the loop at the new interval", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    const { rerender } = renderHook(
      ({ interval }: { interval: number }) => usePolling({ fetcher, interval }),
      { initialProps: { interval: 3000 } },
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    // Switch to 30s interval — effect re-runs, triggers an immediate fetch
    rerender({ interval: 30000 });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    // Advance 3s — old interval would have fired again, new one should not
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Advance to 30s from last fetch — new interval should fire now
    await act(async () => {
      await vi.advanceTimersByTimeAsync(27000);
    });
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(3);
    });
  });

  it("changing enabled from false to true triggers an immediate fetch then the loop", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 1 });

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePolling({ fetcher, interval: 3000, enabled }),
      { initialProps: { enabled: false } },
    );

    // Should not have fetched while disabled
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetcher).not.toHaveBeenCalled();

    // Enable — should fire immediately
    rerender({ enabled: true });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    // Then fire again at the next interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
});
