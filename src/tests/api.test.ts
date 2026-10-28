import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  mutateApi,
  clearApiSession,
  queryString,
  download,
} from "../lib/api";
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const ok = (data: unknown) => response({ success: true, data });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  clearApiSession();
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
describe("API client", () => {
  it("includes cookies and disables browser response caching", async () => {
    fetcher.mockResolvedValue(ok([]));
    await api("/api/reports");
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      credentials: "include",
      cache: "no-store",
    });
  });
  it("gets CSRF before mutation and uses the rotated token", async () => {
    fetcher
      .mockResolvedValueOnce(ok({ csrfToken: "initial" }))
      .mockResolvedValueOnce(ok({ csrfToken: "rotated" }))
      .mockResolvedValueOnce(ok(null));
    await mutateApi("/api/auth/login", "POST", {
      username: "synthetic",
      password: "not-a-real-password",
    });
    await mutateApi("/api/auth/logout", "POST");
    expect(fetcher.mock.calls[1][1].headers.get("X-CSRF-Token")).toBe(
      "initial",
    );
    expect(fetcher.mock.calls[2][1].headers.get("X-CSRF-Token")).toBe(
      "rotated",
    );
  });
  it("retries only an explicit CSRF rejection, once, preserving payload and idempotency", async () => {
    fetcher
      .mockResolvedValueOnce(ok({ csrfToken: "old" }))
      .mockResolvedValueOnce(response({ error: { code: "CSRF_INVALID" } }, 403))
      .mockResolvedValueOnce(ok({ csrfToken: "new" }))
      .mockResolvedValueOnce(ok({ id: 2 }));
    await mutateApi(
      "/api/reports",
      "POST",
      { mrNumber: "00012", categoryIds: [2] },
      { "Idempotency-Key": "test-key-1234" },
    );
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(fetcher.mock.calls[3][1].body).toBe(fetcher.mock.calls[1][1].body);
    expect(fetcher.mock.calls[3][1].headers.get("Idempotency-Key")).toBe(
      "test-key-1234",
    );
  });
  it("does not loop on persistent CSRF rejection", async () => {
    fetcher
      .mockResolvedValueOnce(ok({ csrfToken: "old" }))
      .mockResolvedValueOnce(response({ error: { code: "CSRF_INVALID" } }, 403))
      .mockResolvedValueOnce(ok({ csrfToken: "new" }))
      .mockResolvedValueOnce(
        response({ error: { code: "CSRF_INVALID" } }, 403),
      );
    await expect(mutateApi("/api/reports", "POST", {})).rejects.toMatchObject({
      code: "CSRF_INVALID",
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it("does not retry uncertain report submissions automatically", async () => {
    fetcher
      .mockResolvedValueOnce(ok({ csrfToken: "token" }))
      .mockRejectedValueOnce(new TypeError("network"));
    await expect(mutateApi("/api/reports", "POST", {})).rejects.toMatchObject({
      status: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("never exposes raw service error details", async () => {
    fetcher.mockResolvedValue(
      response(
        {
          error: {
            code: "DB_ERROR",
            message: "secret SQL stack",
            details: [{ path: "db", message: "secret" }],
          },
        },
        500,
      ),
    );
    await expect(api("/api/reports")).rejects.toMatchObject({
      message: "The service is temporarily unavailable. Please try again.",
      details: [],
    });
  });
  it("signals expired sessions without treating bad login as session expiry", async () => {
    const expired = vi.fn();
    window.addEventListener("session-expired", expired);
    fetcher.mockResolvedValue(
      response({ error: { code: "SESSION_EXPIRED" } }, 401),
    );
    await expect(api("/api/reports")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener("session-expired", expired);
  });
  it("signals mandatory password change", async () => {
    const required = vi.fn();
    window.addEventListener("password-required", required);
    fetcher.mockResolvedValue(
      response({ error: { code: "PASSWORD_CHANGE_REQUIRED" } }, 403),
    );
    await expect(api("/api/categories")).rejects.toMatchObject({
      code: "PASSWORD_CHANGE_REQUIRED",
    });
    expect(required).toHaveBeenCalledOnce();
    window.removeEventListener("password-required", required);
  });
  it("rejects HTML responses rather than pretending success", async () => {
    fetcher.mockResolvedValue(new Response("<html/>"));
    await expect(api("/api/auth/me")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("normalizes rate limiting", async () => {
    fetcher.mockResolvedValue(response({}, 429));
    await expect(api("/api/reports")).rejects.toMatchObject({
      status: 429,
      message: "Too many requests. Please wait before trying again.",
    });
  });
  it("encodes filters without losing leading zeros", () => {
    expect(queryString({ mrNumber: "00012", role: "", page: "1" })).toBe(
      "?mrNumber=00012&page=1",
    );
  });
  it("rejects JSON pretending to be a binary export and omits pagination", async () => {
    fetcher.mockResolvedValue(ok([]));
    await expect(
      download("pdf", { page: "2", limit: "20", mrNumber: "00012" }),
    ).rejects.toMatchObject({ code: "INVALID_EXPORT" });
    expect(fetcher.mock.calls[0][0]).toBe(
      "/api/exports/reports.pdf?mrNumber=00012",
    );
  });
});
