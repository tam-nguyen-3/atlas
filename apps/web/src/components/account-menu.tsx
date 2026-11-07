import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { useServices } from "@/lib/app-context";
import { errorMessage } from "@/lib/errors";
import { Button } from "./ui/button";
import { useRetryDelay } from "./ui/request-state";

export function AccountMenu({
  closeNavigation,
}: {
  closeNavigation?: () => void;
}) {
  const session = useServices();
  const profile = useQuery({ ...session.meOptions, enabled: false }).data;
  const navigate = useNavigate();
  const active = useRouterState({
    select: (state) => state.location.pathname === "/profile",
  });
  const [open, setOpen] = useState(false);
  const signOut = useMutation({
    mutationFn: session.signOut,
    onSuccess: async () => {
      closeNavigation?.();
      await navigate({ to: "/sign-in", search: {}, replace: true });
    },
  });
  const remaining = useRetryDelay(signOut.error);
  return (
    <div className="account">
      {/* The menu is non-modal; the navigation sheet owns mobile modality. */}
      <Dropdown.Root open={open} onOpenChange={setOpen} modal={false}>
        <Dropdown.Trigger asChild>
          <Button
            variant="ghost"
            className={`nav-link account-trigger${active ? " active" : ""}`}
            aria-label={`Account menu for ${profile?.displayName ?? "your account"}`}
          >
            <UserRound size={19} aria-hidden="true" />
            <span className="account-name">{profile?.displayName}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Portal>
          <Dropdown.Content
            className="account-menu"
            align="end"
            sideOffset={8}
            collisionPadding={12}
          >
            <Dropdown.Label className="account-menu-label">
              {profile?.displayName}
            </Dropdown.Label>
            <Dropdown.Item asChild>
              <Link
                to="/profile"
                search={(previous) => previous}
                className="account-menu-item"
                onClick={() => {
                  setOpen(false);
                  closeNavigation?.();
                }}
                aria-current={active ? "page" : undefined}
              >
                <UserRound size={17} aria-hidden="true" />
                My profile
              </Link>
            </Dropdown.Item>
            <Dropdown.Separator className="account-menu-separator" />
            <Dropdown.Item
              asChild
              disabled={signOut.isPending || remaining > 0}
              onSelect={(event) => {
                event.preventDefault();
                signOut.mutate();
              }}
            >
              <Button
                variant="ghost"
                className="account-menu-item"
                busy={signOut.isPending}
                disabled={remaining > 0}
              >
                <LogOut size={17} aria-hidden="true" />
                {signOut.isError ? "Retry sign out" : "Sign out"}
              </Button>
            </Dropdown.Item>
            {signOut.isError && (
              <p role="alert" className="account-menu-feedback error-text">
                {errorMessage(signOut.error)}
              </p>
            )}
            {remaining > 0 && (
              <p role="status" className="account-menu-feedback">
                Try again in {remaining} seconds.
              </p>
            )}
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>
    </div>
  );
}
