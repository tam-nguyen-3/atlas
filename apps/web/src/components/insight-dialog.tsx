import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { X, ArrowUpRight } from "lucide-react";
import { useEffect } from "react";
import { useServices } from "@/lib/app-context";
import { detailOptions } from "@/lib/insights";
import { ClientError } from "@/lib/errors";
import { Button } from "./ui/button";
import { RequestState } from "./ui/request-state";
import { InsightActions, InsightMetadata } from "./insight";

export function InsightDialog({
  id,
  close,
  restoreFocus,
}: {
  id: string;
  close: () => void;
  restoreFocus: () => void;
}) {
  const session = useServices();
  const userId = session.queryClient.getQueryData(
    session.meOptions.queryKey,
  )!.id;
  const detail = useQuery(detailOptions(session, userId, id));
  const missing =
    detail.error instanceof ClientError && detail.error.status === 404;
  const title = missing
    ? "Insight not found"
    : (detail.data?.title ?? "Insight details");
  useEffect(() => {
    document.title = `${title} · Minerva Atlas`;
    return () => {
      document.title = "Browse · Minerva Atlas";
    };
  }, [title]);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="insight-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
        >
          <div className="detail-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Button variant="ghost" aria-label="Close insight" onClick={close}>
              <X size={22} aria-hidden="true" />
            </Button>
          </div>
          <Dialog.Description className="sr-only">
            Community advice shared by a Minervan.
          </Dialog.Description>
          {missing ? (
            <div className="empty-state">
              <p>This insight may have been deleted.</p>
              <Button variant="outline" onClick={close}>
                Back to Browse
              </Button>
            </div>
          ) : detail.isError ? (
            <RequestState
              error={detail.error}
              retry={() => {
                void detail.refetch();
              }}
            />
          ) : !detail.data ? (
            <RequestState pendingLabel="Loading insight…" />
          ) : (
            <div className="detail-body">
              <InsightMetadata insight={detail.data} />
              <p className="insight-prose">{detail.data.body}</p>
              {detail.data.sourceUrl && (
                <a
                  className="text-link source-link"
                  href={detail.data.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View source <ArrowUpRight size={16} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <InsightActions insight={detail.data} />
              {detail.data.places.length > 0 && (
                <p className="places-upcoming muted">
                  Place details are coming soon.
                </p>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
