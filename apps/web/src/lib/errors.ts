import { apiErrorSchema } from "@atlas/shared";
import { z } from "zod";

export class ClientError extends Error {
  constructor(
    message: string,
    public readonly source: "atlas" | "auth" | "network" | "response",
    public readonly status?: number,
    public readonly code?: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ClientError";
  }
}

export function isCancellation(error: unknown): error is Error {
  return error instanceof Error && error.name === "AbortError";
}

export function networkError(error: unknown): Error {
  if (isCancellation(error) || error instanceof ClientError) return error;
  return new ClientError(
    "Atlas couldn’t be reached. Check your connection and try again.",
    "network",
  );
}

export function atlasError(body: unknown, status: number): ClientError {
  const result = apiErrorSchema.safeParse(body);
  return new ClientError(
    status >= 500
      ? "Atlas is unavailable right now. Try again."
      : result.success
        ? result.data.error.message
        : "Atlas returned an unexpected response. Try again.",
    "atlas",
    status,
    result.success ? result.data.error.code : undefined,
  );
}

const nativeErrorSchema = z.object({
  message: z.string().optional(),
  code: z.string().optional(),
});

export function authError(
  body: unknown,
  status: number,
  headers?: Headers,
): ClientError {
  const result = nativeErrorSchema.safeParse(body);
  const value = headers?.get("X-Retry-After");
  const seconds = value && /^\d+$/.test(value) ? Number(value) : undefined;
  return new ClientError(
    status >= 500
      ? "Atlas is unavailable right now. Try again."
      : status === 401
        ? "Email or password is incorrect."
        : status === 429
          ? "Too many attempts. Wait a moment before trying again."
          : result.success && result.data.message
            ? result.data.message
            : "This request couldn’t be completed. Try again.",
    "auth",
    status,
    result.success ? result.data.code : undefined,
    seconds !== undefined && Number.isSafeInteger(seconds)
      ? seconds
      : undefined,
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof ClientError
    ? error.message
    : "This request couldn’t be completed. Try again.";
}
