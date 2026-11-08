import * as Dialog from "@radix-ui/react-dialog";
import { useRef } from "react";
import { Button } from "./button";

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancel,
  confirm,
  busy = false,
  error,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancel: () => void;
  confirm: () => void;
  busy?: boolean;
  error?: string;
}) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) cancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay confirmation-overlay" />
        <Dialog.Content
          className="insight-dialog confirmation-dialog"
          role="alertdialog"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            cancelButton.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              ref={cancelButton}
              disabled={busy}
              onClick={cancel}
            >
              Cancel
            </Button>
            <Button variant="destructive" busy={busy} onClick={confirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
