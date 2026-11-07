import { useEffect, useState } from "react";
import { ClientError, errorMessage } from "@/lib/errors";
import { Button } from "./button";

export function useRetryDelay(error: unknown) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!(error instanceof ClientError) || error.status !== 429) {
      setRemaining(0);
      return;
    }
    const deadline = Date.now() + (error.retryAfterSeconds ?? 10) * 1000;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [error]);
  return remaining;
}

export function RequestState({
  error,
  retry,
  pendingLabel = "Loading Atlas…",
}: {
  error?: unknown;
  retry?: () => void;
  pendingLabel?: string;
}) {
  return (
    <section className="request-state" aria-label="Request status">
      {error ? (
        <>
          <p role="alert" className="error-text">
            {errorMessage(error)}
          </p>
          {retry && (
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          )}
        </>
      ) : (
        <p role="status">{pendingLabel}</p>
      )}
    </section>
  );
}
