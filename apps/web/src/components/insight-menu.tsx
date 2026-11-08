import { useRef, useState } from "react";
import { MoreHorizontal, Copy, Pencil, Trash2 } from "lucide-react";
import type { InsightDetail, InsightFeedItem } from "@atlas/shared";
import { useServices } from "@/lib/app-context";
import { useContribution } from "./contribution";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
export function InsightMenu({
  insight,
}: {
  insight: InsightDetail | InsightFeedItem;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const session = useServices();
  const author =
    session.queryClient.getQueryData(session.meOptions.queryKey)?.id ===
    insight.author.id;
  const contribution = useContribution();
  const [copy, setCopy] = useState<"success" | "failure" | null>(null);
  const url = new URL(
    `/browse?insight=${encodeURIComponent(insight.id)}`,
    window.location.origin,
  ).href;
  async function copyLink() {
    setCopy(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopy("success");
    } catch {
      setCopy("failure");
    }
  }
  return (
    <div className="insight-menu-container">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            aria-label="Insight actions"
            title="Insight actions"
            ref={trigger}
          >
            <MoreHorizontal size={22} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            className="account-menu-item"
            onSelect={() => {
              void copyLink();
            }}
          >
            <Copy size={17} aria-hidden="true" />
            Copy link
          </DropdownMenuItem>
          {author && (
            <>
              <DropdownMenuItem
                className="account-menu-item"
                onSelect={() =>
                  contribution.edit(insight.id, trigger.current ?? undefined)
                }
              >
                <Pencil size={17} aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator className="account-menu-separator" />
              <DropdownMenuItem
                className="account-menu-item danger-text"
                onSelect={() =>
                  contribution.remove(insight, trigger.current ?? undefined)
                }
              >
                <Trash2 size={17} aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" className="copy-status">
        {copy === "success" ? "Link copied." : ""}
      </span>
      {copy === "failure" && (
        <div className="copy-feedback">
          <p role="alert">Couldn’t copy. Select and copy this link:</p>
          <Input
            aria-label="Insight link"
            value={url}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </div>
  );
}
