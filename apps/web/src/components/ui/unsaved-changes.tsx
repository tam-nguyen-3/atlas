import { useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { ConfirmDialog } from "./confirm-dialog";

export function useUnsavedChanges(
  dirty: boolean,
  busy = false,
  scope: "page" | "all" = "all",
  discardNavigation?: () => void,
) {
  const released = useRef(false);
  const [discard, setDiscard] = useState<(() => void) | null>(null);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      !released.current &&
      (dirty || busy) &&
      (scope === "all" || current.pathname !== next.pathname),
    enableBeforeUnload: dirty || busy,
    withResolver: true,
  });
  function guard(action: () => void) {
    if (busy) return;
    if (dirty) setDiscard(() => action);
    else action();
  }
  const confirmation = (discard || blocker.status === "blocked") && (
    <ConfirmDialog
      title={busy ? "Save in progress" : "Discard unsaved changes?"}
      description={
        busy
          ? "Wait for your save to finish before leaving."
          : "Your changes will be lost if you leave without saving."
      }
      confirmLabel="Discard changes"
      busy={busy}
      cancel={() => {
        setDiscard(null);
        blocker.reset?.();
      }}
      confirm={() => {
        const action = discard;
        setDiscard(null);
        if (blocker.status === "blocked") {
          discardNavigation?.();
          blocker.proceed();
        } else action?.();
      }}
    />
  );
  return {
    guard,
    confirmation,
    release: () => {
      released.current = true;
    },
  };
}
