import { createAuthClient } from "better-auth/client";
import { authError, networkError } from "./errors";
import { RequestScope } from "./request-scope";

export interface SignInInput {
  email: string;
  password: string;
}
export interface SignUpInput extends SignInInput {
  name: string;
}

export function createAuthAdapter(
  scope: RequestScope,
  fetcher: typeof fetch = fetch,
) {
  // Only the client entry point enters the browser bundle. No server type import.
  const client = createAuthClient({
    basePath: "/api/auth",
    fetchOptions: {
      credentials: "include",
      retry: 0,
      customFetchImpl: fetcher,
    },
  });
  function execute(
    action: "signIn" | "signUp" | "signOut",
    input?: SignInInput | SignUpInput,
    signal?: AbortSignal,
  ) {
    return scope.run(
      async (requestSignal) => {
        try {
          let failure: Error | undefined;
          const options = {
            signal: requestSignal,
            retry: 0,
            disableSignal: true,
            onError: ({
              error,
              response,
            }: {
              error: unknown;
              response: Response;
            }) => {
              failure = authError(error, response.status, response.headers);
            },
          };
          const result =
            action === "signOut"
              ? await client.signOut({}, options)
              : action === "signUp"
                ? await client.signUp.email(input as SignUpInput, options)
                : await client.signIn.email(input as SignInInput, options);
          if (failure) throw failure;
          if (result.error) throw authError(result.error, result.error.status);
        } catch (error) {
          throw networkError(error);
        }
      },
      signal,
      false,
    );
  }
  return {
    signIn: (input: SignInInput, signal?: AbortSignal) =>
      execute("signIn", input, signal),
    signUp: (input: SignUpInput, signal?: AbortSignal) =>
      execute("signUp", input, signal),
    signOut: (signal?: AbortSignal) => execute("signOut", undefined, signal),
  };
}
