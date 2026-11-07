import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "./button";
export function NavigationSheet({
  children,
}: {
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          className="mobile-menu"
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content className="sheet-content">
          <div className="sheet-heading">
            <Dialog.Title>Explore Atlas</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" aria-label="Close navigation">
                <X size={22} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted">
            Your Minerva city companion.
          </Dialog.Description>
          {children(() => setOpen(false))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
