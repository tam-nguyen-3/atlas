import { afterEach, describe, expect, test, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { createApiClient } from "./api";
import { createAuthAdapter } from "./auth";
import { ClientError, authError } from "./errors";
import { RequestScope } from "./request-scope";
import { createSession, ME_KEY } from "./session";

const profile = {
  id: "21ce2102-80a6-48db-8d30-93f810fb4321",
  email: "ada@minerva.edu",
  displayName: "Ada",
  cohort: null,
  avatarUrl: null,
};
const reply = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const clients: ReturnType<typeof createSession>[] = [];
afterEach(() => {
  for (const session of clients.splice(0)) session.queryClient.clear();
});
function sessionWith(fetcher: typeof fetch) {
  const session = createSession(fetcher);
  clients.push(session);
  return session;
}

describe("Atlas transport", () => {
  test("uses same-origin cookies, runtime schemas, and cancellation signals", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply(profile));
    const api = createApiClient(new RequestScope(), fetcher);
    expect(await api.getMe()).toEqual(profile);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
      }),
    );
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    fetcher.mockResolvedValueOnce(reply({ ...profile, id: "bad" }));
    await expect(api.getMe()).rejects.toMatchObject({
      source: "response",
      status: 200,
    });
    fetcher.mockResolvedValueOnce(new Response("not json"));
    await expect(api.getMe()).rejects.toMatchObject({ source: "response" });
  });
  test("normalizes Atlas envelopes and distinguishes outages", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        reply({ error: { code: "FORBIDDEN", message: "Access denied." } }, 403),
      );
    const scope = new RequestScope();
    scope.onUnauthorized = vi.fn();
    const api = createApiClient(scope, fetcher);
    await expect(api.getCities()).rejects.toMatchObject({
      source: "atlas",
      status: 403,
      code: "FORBIDDEN",
    });
    fetcher.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(api.getCities()).rejects.toMatchObject({ source: "network" });
    fetcher.mockResolvedValueOnce(reply({}, 503));
    await expect(api.getCities()).rejects.toMatchObject({ status: 503 });
    expect(scope.onUnauthorized).not.toHaveBeenCalled();
  });
  test.each([200, 401])(
    "discards late %i responses across session changes",
    async (status) => {
      let resolve!: (response: Response) => void;
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const scope = new RequestScope();
      scope.onUnauthorized = vi.fn();
      const result = createApiClient(scope, fetcher).getCities();
      const assertion = expect(result).rejects.toMatchObject({
        name: "AbortError",
      });
      scope.reset();
      resolve(reply([], status));
      await assertion;
      expect(scope.onUnauthorized).not.toHaveBeenCalled();
    },
  );
  test("external abort is cancellation, never logout", async () => {
    const scope = new RequestScope();
    scope.onUnauthorized = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      createApiClient(scope, fetcher).getCities(controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(scope.onUnauthorized).not.toHaveBeenCalled();
  });
});

describe("official Better Auth adapter", () => {
  test("submits only the specified sign-up fields and never reads its own session", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(reply({ token: "opaque", user: {} }));
    const auth = createAuthAdapter(new RequestScope(), fetcher);
    await auth.signUp({
      name: "Ada",
      email: profile.email,
      password: "long-password",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    const resolvedUrl =
      typeof url === "string"
        ? new URL(url)
        : url instanceof Request
          ? new URL(url.url)
          : url;
    expect(resolvedUrl.pathname).toBe("/api/auth/sign-up/email");
    expect(resolvedUrl.origin).toBe(window.location.origin);
    if (typeof init?.body !== "string")
      throw new Error("Expected a JSON request body");
    const body: unknown = JSON.parse(init.body);
    expect(body).toEqual({
      name: "Ada",
      email: profile.email,
      password: "long-password",
    });
    expect(init?.credentials).toBe("include");
  });
  test("reads message-only rate limits and headers without retrying", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        reply({ message: "Slow down" }, 429, { "X-Retry-After": "3" }),
      );
    await expect(
      createAuthAdapter(new RequestScope(), fetcher).signIn({
        email: profile.email,
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      source: "auth",
      status: 429,
      retryAfterSeconds: 3,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test("credential 401 does not trigger session loss", async () => {
    const scope = new RequestScope();
    scope.onUnauthorized = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        reply({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid" }, 401),
      );
    await expect(
      createAuthAdapter(scope, fetcher).signIn({
        email: profile.email,
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({
      message: "Email or password is incorrect.",
      status: 401,
    });
    expect(scope.onUnauthorized).not.toHaveBeenCalled();
  });
  test("ignores malformed retry delays", () => {
    for (const value of ["NaN", "-1", "Infinity", "999999999999999999999"])
      expect(
        authError({}, 429, new Headers({ "X-Retry-After": value }))
          .retryAfterSeconds,
      ).toBeUndefined();
  });
});

describe("session query and cache isolation", () => {
  test("mounted session observers see sign-out immediately", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply(profile)));
    const session = sessionWith(fetcher);
    await session.verify();
    const observer = new QueryObserver(session.queryClient, {
      ...session.meOptions,
      enabled: false,
    });
    const unsubscribe = observer.subscribe(() => {});
    fetcher.mockResolvedValueOnce(reply({ success: true }));
    await session.signOut();
    expect(observer.getCurrentResult().data).toBeNull();
    unsubscribe();
  });
  test("refreshes /me instead of accepting the cached profile on navigation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply(profile)));
    const session = sessionWith(fetcher);
    await session.verify();
    await session.verify();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/me",
      "/api/me",
    ]);
  });
  test("unavailable /me retains identity and data; subsequent retry recovers", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply(profile)));
    const session = sessionWith(fetcher);
    await session.verify();
    session.queryClient.setQueryData(["private"], "retained");
    fetcher.mockResolvedValueOnce(reply({}, 500));
    await expect(session.verify()).rejects.toBeInstanceOf(ClientError);
    expect(session.queryClient.getQueryData(ME_KEY)).toEqual(profile);
    expect(session.queryClient.getQueryData(["private"])).toBe("retained");
    expect(await session.verify()).toEqual(profile);
  });
  test("revoked session clears private data and mutation state, keeping city preference", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply(profile)));
    const session = sessionWith(fetcher);
    await session.verify();
    localStorage.setItem("atlas:last-city", "general");
    session.queryClient.setQueryData(["private"], "secret");
    session.queryClient.getMutationCache().build(session.queryClient, {
      mutationFn: () => Promise.resolve("secret"),
    });
    fetcher.mockResolvedValueOnce(
      reply({ error: { code: "UNAUTHORIZED", message: "Sign in" } }, 401),
    );
    expect(await session.verify()).toBeNull();
    expect(session.queryClient.getQueryData(["private"])).toBeUndefined();
    expect(session.queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem("atlas:last-city")).toBe("general");
  });
  test("switching users clears cached data before the new profile is published", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply(profile)));
    const session = sessionWith(fetcher);
    await session.verify();
    session.queryClient.setQueryData(["private", profile.id], "Ada data");
    const next = {
      ...profile,
      id: "c568a69d-d591-46e6-a9f3-8bc3a1be394d",
      displayName: "Grace",
    };
    fetcher.mockResolvedValueOnce(reply(next));
    expect(await session.verify()).toEqual(next);
    expect(
      session.queryClient.getQueryData(["private", profile.id]),
    ).toBeUndefined();
    expect(session.queryClient.getQueryData(ME_KEY)).toEqual(next);
  });
  test("protected 401 expires the session, while failed sign-out retains it", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply(profile)));
    const session = sessionWith(fetcher);
    await session.verify();
    fetcher.mockResolvedValueOnce(reply({}, 503));
    await expect(session.signOut()).rejects.toMatchObject({ status: 503 });
    expect(session.queryClient.getQueryData(ME_KEY)).toEqual(profile);
    fetcher.mockResolvedValueOnce(
      reply({ error: { code: "UNAUTHORIZED", message: "Sign in" } }, 401),
    );
    await expect(session.api.getCategories()).rejects.toMatchObject({
      status: 401,
    });
    expect(session.queryClient.getQueryData(ME_KEY)).toBeNull();
  });
  test("confirmed sign-out clears caches and coalesces concurrent requests", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(reply({ success: true })));
    const session = sessionWith(fetcher);
    session.queryClient.setQueryData(["private"], "secret");
    await Promise.all([session.signOut(), session.signOut()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(session.queryClient.getQueryData(["private"])).toBeUndefined();
    expect(session.queryClient.getQueryData(ME_KEY)).toBeNull();
  });
});

describe("insight transport", () => {
  test("serializes only feed parameters and validates response contracts", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(reply({ items: [], page: 2, limit: 20, total: 0 }));
    const api = createApiClient(new RequestScope(), fetcher);
    await api.getInsights({
      city: "tokyo",
      q: "café & tea",
      sort: "relevance",
      page: 2,
      limit: 20,
    });
    const requestUrl = fetcher.mock.calls[0]![0];
    if (typeof requestUrl !== "string")
      throw new Error("Expected a relative URL");
    const url = new URL(requestUrl, "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      city: "tokyo",
      q: "café & tea",
      sort: "relevance",
      page: "2",
      limit: "20",
    });
    fetcher.mockResolvedValueOnce(reply({ items: [], page: -1, total: 0 }));
    await expect(
      api.getInsights({ city: "general", sort: "newest", page: 1, limit: 20 }),
    ).rejects.toMatchObject({ source: "response" });
    fetcher.mockResolvedValueOnce(
      reply({ id: profile.id, body: "incomplete" }),
    );
    await expect(api.getInsight(profile.id)).rejects.toMatchObject({
      source: "response",
    });
  });
  test("uses idempotent vote methods, schemas, and protected-session cancellation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(reply({ upvoteCount: 1, viewerHasUpvoted: true })),
      );
    const scope = new RequestScope();
    scope.onUnauthorized = vi.fn();
    const api = createApiClient(scope, fetcher);
    expect(await api.setVote(profile.id, true)).toEqual({
      upvoteCount: 1,
      viewerHasUpvoted: true,
    });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "PUT",
      credentials: "include",
      cache: "no-store",
    });
    await api.setVote(profile.id, false);
    expect(fetcher.mock.calls[1]?.[1]?.method).toBe("DELETE");
    fetcher.mockResolvedValueOnce(
      reply({ upvoteCount: -1, viewerHasUpvoted: true }),
    );
    await expect(api.setVote(profile.id, true)).rejects.toMatchObject({
      source: "response",
    });
    fetcher.mockResolvedValueOnce(
      reply({ error: { code: "UNAUTHORIZED", message: "Sign in" } }, 401),
    );
    await expect(api.getInsight(profile.id)).rejects.toMatchObject({
      status: 401,
    });
    expect(scope.onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe("contribution transport", () => {
  test("sends JSON profile updates and validates the returned profile", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(reply({ ...profile, cohort: "M27" }));
    const api = createApiClient(new RequestScope(), fetcher);
    expect((await api.updateProfile({ cohort: "M27" })).cohort).toBe("M27");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        body: JSON.stringify({ cohort: "M27" }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }),
    );
    fetcher.mockResolvedValueOnce(reply({}));
    await expect(api.updateProfile({ cohort: null })).rejects.toMatchObject({
      source: "response",
    });
  });
  test("DELETE accepts an empty 204 and a repeated 404 stays an error", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        reply({ error: { code: "NOT_FOUND", message: "Missing" } }, 404),
      );
    const api = createApiClient(new RequestScope(), fetcher);
    await expect(api.deleteInsight(profile.id)).resolves.toBeUndefined();
    await expect(api.deleteInsight(profile.id)).rejects.toMatchObject({
      status: 404,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  test("editing leaves places omitted and does not retry rejected writes", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        reply({ error: { code: "FORBIDDEN", message: "Not the author" } }, 403),
      );
    const scope = new RequestScope();
    scope.onUnauthorized = vi.fn();
    const fields = {
      title: null,
      sourceUrl: null,
      citySlugs: [],
      categorySlugs: ["food"],
      body: "Updated advice",
    };
    await expect(
      createApiClient(scope, fetcher).updateInsight(profile.id, fields),
    ).rejects.toMatchObject({ status: 403 });
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify(fields));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(scope.onUnauthorized).not.toHaveBeenCalled();
  });
  test("late profile writes cannot publish across a session reset", async () => {
    let resolve!: (value: Response) => void;
    const scope = new RequestScope();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const pending = createApiClient(scope, fetcher).updateProfile({
      displayName: "Updated",
    });
    const assertion = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    scope.reset();
    resolve(reply(profile));
    await assertion;
  });
});
