import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock firebase before importing client
vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(),
}));

import { apiFetch, ApiError } from "../client";
import { getFirebaseAuth } from "@/lib/firebase";

const mockGetFirebaseAuth = vi.mocked(getFirebaseAuth);

describe("apiFetch", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
    vi.stubGlobal("fetch", vi.fn());
    mockGetFirebaseAuth.mockReturnValue(null);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws if NEXT_PUBLIC_API_URL is not set", async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    await expect(apiFetch("/test")).rejects.toThrow(
      "NEXT_PUBLIC_API_URL is not configured",
    );
  });

  it("makes request to correct URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await apiFetch("/players/123");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/players/123",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("attaches Authorization header when user is authenticated", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    mockGetFirebaseAuth.mockReturnValue({
      currentUser: {
        getIdToken: vi.fn().mockResolvedValue("test-token-123"),
      },
    } as never);

    await apiFetch("/test");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token-123",
        }),
      }),
    );
  });

  it("does not attach Authorization header when not authenticated", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    mockGetFirebaseAuth.mockReturnValue(null);

    await apiFetch("/test");

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<
      string,
      string
    >;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("retries on 401 with refreshed token", async () => {
    const mockFetch = vi.mocked(fetch);

    // First call returns 401
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 }),
    );
    // Retry succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: "success" }), { status: 200 }),
    );

    mockGetFirebaseAuth.mockReturnValue({
      currentUser: {
        getIdToken: vi
          .fn()
          .mockResolvedValueOnce("old-token")
          .mockResolvedValueOnce("new-token"),
      },
    } as never);

    const result = await apiFetch("/test");

    expect(result).toEqual({ data: "success" });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should use refreshed token
    const retryHeaders = mockFetch.mock.calls[1][1]?.headers as Record<
      string,
      string
    >;
    expect(retryHeaders["Authorization"]).toBe("Bearer new-token");
  });

  it("throws ApiError on non-401 errors", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Not found" }), { status: 404 }),
    );

    const error = await apiFetch("/test").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe("Not found");
    expect((error as ApiError).status).toBe(404);
  });

  it("parses array detail errors", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: [{ msg: "Field required" }, { msg: "Invalid value" }],
        }),
        { status: 422 },
      ),
    );

    await expect(apiFetch("/test")).rejects.toThrow(
      "Field required, Invalid value",
    );
  });

  it("returns undefined for 204 responses", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiFetch("/test");
    expect(result).toBeUndefined();
  });
});
