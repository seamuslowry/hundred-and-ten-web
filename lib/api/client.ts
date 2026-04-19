import { getFirebaseAuth } from "@/lib/firebase";

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not configured");
  return url;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAuthToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken();
}

async function refreshAuthToken(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) return null;
  return auth.currentUser.getIdToken(true);
}

function parseErrorMessage(body: unknown): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d.msg || String(d)).join(", ");
    }
  }
  return "An unexpected error occurred";
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // ignore parse errors
  }

  throw new ApiError(response.status, parseErrorMessage(body));
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const baseUrl = getBaseUrl();

  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  // On 401, try refreshing the token and retrying once
  if (response.status === 401 && token) {
    const newToken = await refreshAuthToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
      return handleResponse<T>(retryResponse);
    }

    // Token refresh failed — redirect to sign-in
    if (typeof window !== "undefined") {
      const returnTo = window.location.pathname;
      window.location.href = `/?returnTo=${encodeURIComponent(returnTo)}`;
    }
    throw new ApiError(401, "Authentication required");
  }

  return handleResponse<T>(response);
}
