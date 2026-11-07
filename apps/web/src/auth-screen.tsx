import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useServices } from "./lib/app-context";
import {
  safeReturnTo,
  signInSchema,
  signUpSchema,
} from "./lib/auth-validation";
import { ClientError, errorMessage, isCancellation } from "./lib/errors";
import { Input } from "./components/ui/input";
import { PasswordInput } from "./components/ui/password-input";
import { Button } from "./components/ui/button";
import { useRetryDelay } from "./components/ui/request-state";

const fields = z.object({
  name: z.string(),
  email: z.string(),
  password: z.string(),
  confirmation: z.string(),
});

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signUp = mode === "sign-up";
  const session = useServices();
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const returnTo = safeReturnTo(search.returnTo);
  const [failure, setFailure] = useState<unknown>();
  const [accepted, setAccepted] = useState(false);
  const remaining = useRetryDelay(failure);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const schema = fields.superRefine((value, context) => {
    const result = (signUp ? signUpSchema : signInSchema).safeParse(value);
    if (!result.success)
      for (const issue of result.error.issues)
        context.addIssue({
          code: "custom",
          path: issue.path,
          message:
            issue.path[0] === "name"
              ? "Enter a name with 1–100 characters."
              : issue.message,
        });
  });
  const form = useForm({
    defaultValues: { name: "", email: "", password: "", confirmation: "" },
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  const busy = form.formState.isSubmitting;
  // Server field errors arrive while inputs are disabled during submission.
  // Focus after React re-enables them, rather than trying to focus a disabled input.
  useEffect(() => {
    if (!busy && form.formState.errors.email?.type === "server")
      form.setFocus("email");
  }, [busy, form, form.formState.errors.email]);
  useEffect(() => {
    mounted.current = true;
    document.title = `${signUp ? "Sign up" : "Sign in"} · Minerva Atlas`;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, [signUp]);

  async function submit(values: z.infer<typeof fields>) {
    if (remaining || request.current) return;
    setFailure(undefined);
    const controller = new AbortController();
    request.current = controller;
    try {
      if (!accepted) {
        const credentials = {
          email: values.email.trim(),
          password: values.password,
        };
        if (signUp)
          await session.auth.signUp(
            { ...credentials, name: values.name.trim() },
            controller.signal,
          );
        else await session.auth.signIn(credentials, controller.signal);
        if (!mounted.current) return;
        setAccepted(true);
        session.beginAuthentication();
      }
      const profile = await session.verify();
      if (!profile)
        throw new ClientError(
          "Your session couldn’t be confirmed. Check that cookies are enabled, then try signing in again.",
          "auth",
          401,
          "SESSION_NOT_ESTABLISHED",
        );
      if (mounted.current) await navigate({ href: returnTo, replace: true });
    } catch (error) {
      if (!mounted.current || isCancellation(error)) return;
      if (
        error instanceof ClientError &&
        error.code === "SESSION_NOT_ESTABLISHED"
      )
        setAccepted(false);
      if (
        error instanceof ClientError &&
        error.code?.startsWith("USER_ALREADY_EXISTS")
      ) {
        form.setError(
          "email",
          {
            type: "server",
            message:
              "An account with this email already exists. Sign in instead.",
          },
          { shouldFocus: true },
        );
      } else if (
        error instanceof ClientError &&
        error.code === "EMAIL_DOMAIN_NOT_ALLOWED"
      ) {
        form.setError(
          "email",
          { type: "server", message: error.message },
          { shouldFocus: true },
        );
      } else setFailure(error);
    } finally {
      request.current = null;
    }
  }

  function fieldProps(name: "name" | "email" | "password" | "confirmation") {
    return {
      ...form.register(name),
      id: name,
      disabled: busy || accepted,
      "aria-invalid": !!form.formState.errors[name],
      "aria-describedby": `${name}-help`,
    };
  }
  function help(
    name: "name" | "email" | "password" | "confirmation",
    hint = "",
  ) {
    const error = form.formState.errors[name];
    return (
      <p
        id={`${name}-help`}
        className={`field-help${error ? " error-text" : ""}`}
      >
        {error?.message ?? hint}
      </p>
    );
  }
  return (
    <section className="auth-panel" aria-labelledby="auth-heading">
      <p className="eyebrow">YOUR MINERVA COMMUNITY</p>
      <h1 id="auth-heading">
        {signUp ? "Make yourself at home" : "Welcome back"}
      </h1>
      <p className="muted auth-intro">
        {signUp
          ? "Share what you know. Find your feet in a new city."
          : "Sign in to your shared guide to life on rotation."}
      </p>
      <form
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit(submit)(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.nativeEvent.isComposing)
            event.preventDefault();
        }}
      >
        {signUp && (
          <div className="form-field">
            <label htmlFor="name">Name</label>
            <Input
              {...fieldProps("name")}
              autoComplete="name"
              maxLength={100}
            />
            {help("name")}
          </div>
        )}
        <div className="form-field">
          <label htmlFor="email">University email</label>
          <Input
            {...fieldProps("email")}
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          {help("email", signUp ? "Use minerva.edu or uni.minerva.edu." : "")}
        </div>
        <div className="form-field">
          <label htmlFor="password">Password</label>
          <PasswordInput
            {...fieldProps("password")}
            autoComplete={signUp ? "new-password" : "current-password"}
            maxLength={128}
            visibilityLabel="password"
          />
          {help("password", signUp ? "Use 8–128 characters." : "")}
        </div>
        {signUp && (
          <div className="form-field">
            <label htmlFor="confirmation">Confirm password</label>
            <PasswordInput
              {...fieldProps("confirmation")}
              autoComplete="new-password"
              maxLength={128}
              visibilityLabel="password confirmation"
            />
            {help("confirmation")}
          </div>
        )}
        <div className="form-feedback">
          {failure !== undefined && (
            <p role="alert" className="error-text">
              {errorMessage(failure)}
            </p>
          )}
          {remaining > 0 && (
            <p role="status">
              Try again in {remaining} {remaining === 1 ? "second" : "seconds"}.
            </p>
          )}
          {accepted && failure === undefined && (
            <p role="status">
              {busy
                ? "Confirming your session…"
                : "Your account is signed in. Retry the session check to continue."}
            </p>
          )}
        </div>
        <Button
          type="submit"
          className="auth-submit"
          busy={busy}
          disabled={remaining > 0}
        >
          {accepted
            ? "Retry session check"
            : signUp
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>
      <p className="auth-switch">
        {signUp ? "Already have an account?" : "New to Atlas?"}{" "}
        <Link
          to={signUp ? "/sign-in" : "/sign-up"}
          search={{ returnTo }}
          className="text-link"
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {signUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
