import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { InsightDetail, InsightFeedItem } from "@atlas/shared";
import { X } from "lucide-react";
import { useServices } from "@/lib/app-context";
import { detailOptions } from "@/lib/insights";
import { insightFormSchema } from "@/lib/contribution-validation";
import { ClientError, errorMessage, isCancellation } from "@/lib/errors";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { MultiSelection } from "./ui/multi-selection";
import { RequestState } from "./ui/request-state";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { useUnsavedChanges } from "./ui/unsaved-changes";

type Target = InsightDetail | InsightFeedItem;
const ContributionContext = createContext<{
  create: (city: string) => void;
  edit: (id: string, element?: HTMLElement) => void;
  remove: (insight: Target, element?: HTMLElement) => void;
} | null>(null);
export function useContribution() {
  const value = useContext(ContributionContext);
  if (!value) throw new Error("Contribution provider missing");
  return value;
}

export function ContributionProvider({ children }: { children: ReactNode }) {
  const session = useServices();
  const navigate = useNavigate();
  const location = useRouterState({ select: (state) => state.location });
  const userId = session.queryClient.getQueryData(
    session.meOptions.queryKey,
  )!.id;
  const [editor, setEditor] = useState<{ id?: string; city?: string } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const deleteLock = useRef(false);
  // Dirty/pending editor navigation is blocked before the location changes.
  // Pristine overlays belong to their originating list and close on navigation.
  useEffect(() => {
    setEditor(null);
    if (!deleteLock.current) setDeleting(null);
  }, [location.href]);
  const [failure, setFailure] = useState<unknown>();
  const [notice, setNotice] = useState<{ text: string; id?: string } | null>(
    null,
  );
  const opener = useRef<HTMLElement | null>(null);
  const current = () =>
    session.queryClient.getQueryData(session.meOptions.queryKey)?.id === userId;
  function capture(element?: HTMLElement) {
    opener.current =
      element ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
    setNotice(null);
  }
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (opener.current?.isConnected)
        opener.current.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLElement>("#browse-heading, #profile-heading")
          ?.focus({ preventScroll: true });
    });
  }
  function showDetail(id?: string) {
    const search = { ...location.search, insight: id };
    if (location.pathname === "/profile")
      void navigate({
        to: "/profile",
        search,
        state: (previous) => ({
          ...previous,
          atlasInsightOrigin: id ? previous.atlasInsightOrigin : undefined,
        }),
        replace: true,
        resetScroll: false,
      });
    else
      void navigate({
        to: "/browse",
        search,
        state: (previous) => ({
          ...previous,
          atlasInsightOrigin: id ? previous.atlasInsightOrigin : undefined,
        }),
        replace: true,
        resetScroll: false,
      });
  }
  async function deleted() {
    if (!deleting || deleteLock.current) return;
    deleteLock.current = true;
    setBusy(true);
    setFailure(undefined);
    try {
      try {
        await session.api.deleteInsight(deleting.id);
      } catch (error) {
        if (!(error instanceof ClientError && error.status === 404))
          throw error;
      }
      if (!current()) return;
      await session.queryClient.cancelQueries({
        queryKey: ["insight", userId, deleting.id],
      });
      session.queryClient.removeQueries({
        queryKey: ["insight", userId, deleting.id],
      });
      setDeleting(null);
      showDetail();
      setNotice({ text: "Insight deleted." });
      void session.queryClient.invalidateQueries({
        queryKey: ["insights", userId],
      });
    } catch (error) {
      if (current() && !isCancellation(error)) setFailure(error);
    } finally {
      deleteLock.current = false;
      setBusy(false);
    }
  }
  return (
    <ContributionContext.Provider
      value={{
        create: (city) => {
          capture();
          setEditor({ city });
        },
        edit: (id, element) => {
          capture(element);
          setEditor({ id });
        },
        remove: (insight, element) => {
          capture(element);
          setFailure(undefined);
          setDeleting(insight);
        },
      }}
    >
      {notice && (
        <div className="contribution-notice" role="status">
          <span>{notice.text}</span>
          {notice.id && (
            <Button variant="ghost" onClick={() => showDetail(notice.id)}>
              View insight
            </Button>
          )}
          <Button
            variant="ghost"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
      )}
      {children}
      {editor && (
        <EditorLoader
          key={editor.id ?? "create"}
          {...editor}
          close={() => setEditor(null)}
          restoreFocus={restoreFocus}
          saved={(insight) => {
            if (!current()) return;
            session.queryClient.setQueryData(
              detailOptions(session, userId, insight.id).queryKey,
              insight,
            );
            void session.queryClient.invalidateQueries({
              queryKey: ["insights", userId],
            });
            setEditor(null);
            if (editor.id) {
              showDetail(insight.id);
              setNotice({ text: "Insight updated." });
            } else setNotice({ text: "Insight created.", id: insight.id });
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Permanently delete insight?"
          description={`“${deleting.title ?? deleting.author.displayName + "’s insight"}” will be permanently deleted, including its upvotes. This cannot be undone.`}
          confirmLabel="Delete insight"
          busy={busy}
          error={failure ? errorMessage(failure) : undefined}
          cancel={() => {
            setDeleting(null);
            restoreFocus();
          }}
          confirm={() => {
            void deleted();
          }}
        />
      )}
    </ContributionContext.Provider>
  );
}

type EditorProps = {
  id?: string;
  city?: string;
  close: () => void;
  restoreFocus: () => void;
  saved: (insight: InsightDetail) => void;
};
function EditorLoader(props: EditorProps) {
  const session = useServices();
  const userId = session.queryClient.getQueryData(
    session.meOptions.queryKey,
  )!.id;
  const detail = useQuery({
    ...detailOptions(session, userId, props.id ?? ""),
    enabled: !!props.id,
  });
  if (!props.id || detail.data?.isAuthor)
    return <InsightEditor {...props} insight={detail.data} />;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) props.close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay editor-overlay" />
        <Dialog.Content
          className="insight-dialog editor-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            props.restoreFocus();
          }}
        >
          <div className="detail-heading">
            <Dialog.Title>Edit insight</Dialog.Title>
            <Button
              variant="ghost"
              aria-label="Close form"
              onClick={props.close}
            >
              <X size={20} />
            </Button>
          </div>
          <Dialog.Description className="sr-only">
            Load the insight before editing.
          </Dialog.Description>
          {detail.isError ? (
            <RequestState
              error={detail.error}
              retry={() => {
                void detail.refetch();
              }}
            />
          ) : detail.data ? (
            <p role="alert">Only the author can edit this insight.</p>
          ) : (
            <RequestState pendingLabel="Loading insight…" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function InsightEditor({
  insight,
  city,
  close,
  restoreFocus,
  saved,
}: EditorProps & { insight?: InsightDetail }) {
  const session = useServices();
  const userId = session.queryClient.getQueryData(
    session.meOptions.queryKey,
  )!.id;
  const cities = useQuery({
    queryKey: ["cities", userId],
    queryFn: ({ signal }) => session.api.getCities(signal),
  });
  const categories = useQuery({
    queryKey: ["categories", userId],
    queryFn: ({ signal }) => session.api.getCategories(signal),
  });
  const [failure, setFailure] = useState<unknown>();
  const lock = useRef(false);
  const form = useForm<
    z.input<typeof insightFormSchema>,
    unknown,
    z.output<typeof insightFormSchema>
  >({
    resolver: zodResolver(insightFormSchema),
    shouldFocusError: false,
    defaultValues: {
      title: insight?.title ?? "",
      body: insight?.body ?? "",
      sourceUrl: insight?.sourceUrl ?? "",
      categorySlugs: insight?.categories.map((item) => item.slug) ?? [],
      citySlugs:
        insight?.cities.map((item) => item.slug) ??
        (city && city !== "general" ? [city] : []),
    },
  });
  const busy = form.formState.isSubmitting;
  const unsaved = useUnsavedChanges(form.formState.isDirty, busy, "all", close);
  const [detailsOpen, setDetailsOpen] = useState(!!insight?.sourceUrl);
  async function submit(values: z.output<typeof insightFormSchema>) {
    if (lock.current) return;
    lock.current = true;
    setFailure(undefined);
    try {
      // Omission preserves place IDs and their ordering, including concurrent changes.
      const fields = {
        title: values.title,
        body: values.body,
        sourceUrl: values.sourceUrl,
        categorySlugs: values.categorySlugs,
        citySlugs: values.citySlugs,
      };
      const result = insight
        ? await session.api.updateInsight(insight.id, fields)
        : await session.api.createInsight(values);
      if (
        session.queryClient.getQueryData(session.meOptions.queryKey)?.id !==
        userId
      )
        return;
      form.reset(form.getValues());
      unsaved.release();
      saved(result);
    } catch (error) {
      if (!isCancellation(error)) setFailure(error);
    } finally {
      lock.current = false;
    }
  }
  function inputProps(name: "title" | "body" | "sourceUrl") {
    return {
      ...form.register(name),
      id: `insight-${name}`,
      disabled: busy,
      "aria-invalid": !!form.formState.errors[name],
      "aria-describedby": `insight-${name}-help`,
    };
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) unsaved.guard(close);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay editor-overlay" />
        <Dialog.Content
          className="insight-dialog editor-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus();
          }}
        >
          <div className="detail-heading">
            <Dialog.Title>
              {insight ? "Edit insight" : "Create insight"}
            </Dialog.Title>
            <Button
              variant="ghost"
              aria-label="Close form"
              disabled={busy}
              onClick={() => unsaved.guard(close)}
            >
              <X size={22} aria-hidden="true" />
            </Button>
          </div>
          <Dialog.Description className="muted">
            Share practical advice with fellow Minervans.
          </Dialog.Description>
          {cities.isError || categories.isError ? (
            <RequestState
              error={cities.error ?? categories.error}
              retry={() => {
                void cities.refetch();
                void categories.refetch();
              }}
            />
          ) : !cities.data || !categories.data ? (
            <RequestState pendingLabel="Loading form options…" />
          ) : (
            <form
              className="atlas-form"
              noValidate
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing)
                  event.preventDefault();
              }}
              onSubmit={(event) => {
                void form.handleSubmit(submit, (errors) => {
                  if (errors.title) form.setFocus("title");
                  else if (errors.body) form.setFocus("body");
                  else if (errors.categorySlugs)
                    document
                      .querySelector<HTMLInputElement>(
                        "#categories-group input",
                      )
                      ?.focus();
                  else if (errors.citySlugs || errors.sourceUrl) {
                    setDetailsOpen(true);
                    requestAnimationFrame(() => {
                      if (errors.citySlugs)
                        document
                          .querySelector<HTMLInputElement>(
                            "#cities-group input",
                          )
                          ?.focus();
                      else form.setFocus("sourceUrl");
                    });
                  }
                })(event);
              }}
            >
              <div>
                <label htmlFor="insight-title">
                  Title <span className="muted">(optional)</span>
                </label>
                <Input {...inputProps("title")} maxLength={120} />
                <p className="field-help error-text" id="insight-title-help">
                  {form.formState.errors.title
                    ? "Use a title with no more than 120 characters."
                    : ""}
                </p>
              </div>
              <div>
                <label htmlFor="insight-body">Insight</label>
                <Textarea
                  className="resize-none"
                  {...inputProps("body")}
                  rows={8}
                  maxLength={5000}
                />
                <p className="field-help" id="insight-body-help">
                  {form.formState.errors.body ? (
                    <span className="error-text">
                      Enter your insight, up to 5,000 characters.
                    </span>
                  ) : (
                    "Required · Up to 5,000 characters."
                  )}
                </p>
              </div>
              <Controller
                control={form.control}
                name="categorySlugs"
                render={({ field, fieldState }) => (
                  <MultiSelection
                    id="categories"
                    legend="Categories"
                    options={categories.data}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={busy}
                    error={
                      fieldState.error
                        ? "Choose at least one category."
                        : undefined
                    }
                  />
                )}
              />
              <details
                open={detailsOpen}
                onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
              >
                <summary>More details</summary>
                <div className="more-details">
                  <Controller
                    control={form.control}
                    name="citySlugs"
                    render={({ field, fieldState }) => (
                      <MultiSelection
                        id="cities"
                        legend="Cities"
                        options={cities.data}
                        value={field.value}
                        onChange={field.onChange}
                        disabled={busy}
                        error={
                          fieldState.error
                            ? "Choose up to 10 cities."
                            : undefined
                        }
                      />
                    )}
                  />
                  <div>
                    <label htmlFor="insight-sourceUrl">
                      Source URL <span className="muted">(optional)</span>
                    </label>
                    <Input {...inputProps("sourceUrl")} type="url" />
                    <p className="field-help" id="insight-sourceUrl-help">
                      {form.formState.errors.sourceUrl ? (
                        <span className="error-text">
                          Use a complete http:// or https:// URL.
                        </span>
                      ) : (
                        "A link to the original source."
                      )}
                    </p>
                  </div>
                </div>
              </details>
              {insight && insight.places.length > 0 && (
                <p className="muted">
                  {insight.places.length} saved{" "}
                  {insight.places.length === 1 ? "place" : "places"} will be
                  kept.
                </p>
              )}
              <div className="form-feedback" role="alert">
                {failure ? (
                  <span className="error-text">{errorMessage(failure)}</span>
                ) : (
                  ""
                )}
              </div>
              <div className="form-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => unsaved.guard(close)}
                >
                  Cancel
                </Button>
                <Button type="submit" busy={busy}>
                  {insight ? "Save changes" : "Create insight"}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
      {unsaved.confirmation}
    </Dialog.Root>
  );
}
