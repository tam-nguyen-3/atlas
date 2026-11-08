import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Profile as ProfileData } from "@atlas/shared";
import { useServices } from "./lib/app-context";
import { profileFormSchema } from "./lib/contribution-validation";
import { feedOptions } from "./lib/insights";
import { errorMessage, isCancellation } from "./lib/errors";
import { profileSearchSchema } from "./lib/browse-state";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { RequestState } from "./components/ui/request-state";
import { useUnsavedChanges } from "./components/ui/unsaved-changes";
import { InsightRows, InsightPagination } from "./components/insight-list";
import { InsightDialog } from "./components/insight-dialog";

function ProfileForm({ profile }: { profile: ProfileData }) {
  const session = useServices();
  const [failure, setFailure] = useState<unknown>();
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const form = useForm<
    z.input<typeof profileFormSchema>,
    unknown,
    z.output<typeof profileFormSchema>
  >({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.displayName,
      cohort: profile.cohort ?? "",
    },
  });
  const busy = form.formState.isSubmitting;
  const unsaved = useUnsavedChanges(form.formState.isDirty, busy, "page");
  useEffect(() => {
    if (!form.formState.isDirty)
      form.reset({
        displayName: profile.displayName,
        cohort: profile.cohort ?? "",
      });
  }, [profile.displayName, profile.cohort, form]);
  async function submit(values: z.output<typeof profileFormSchema>) {
    if (lock.current) return;
    lock.current = true;
    setSaved(false);
    setFailure(undefined);
    try {
      await session.queryClient.cancelQueries({
        queryKey: session.meOptions.queryKey,
      });
      const updated = await session.api.updateProfile(values);
      if (
        session.queryClient.getQueryData(session.meOptions.queryKey)?.id !==
        profile.id
      )
        return;
      await session.queryClient.cancelQueries({
        queryKey: session.meOptions.queryKey,
      });
      session.queryClient.setQueryData(session.meOptions.queryKey, updated);
      void session.queryClient.invalidateQueries({
        queryKey: ["insights", profile.id],
      });
      void session.queryClient.invalidateQueries({
        queryKey: ["insight", profile.id],
      });
      form.reset({
        displayName: updated.displayName,
        cohort: updated.cohort ?? "",
      });
      setSaved(true);
    } catch (error) {
      if (!isCancellation(error)) setFailure(error);
    } finally {
      lock.current = false;
    }
  }
  return (
    <>
      <form
        className="atlas-form profile-form"
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit(submit)(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.nativeEvent.isComposing)
            event.preventDefault();
        }}
      >
        <div>
          <label htmlFor="profile-email">University email</label>
          <Input
            id="profile-email"
            type="email"
            value={profile.email}
            readOnly
          />
          <p className="field-help muted">
            Your university email cannot be changed.
          </p>
        </div>
        <div>
          <label htmlFor="displayName">Display name</label>
          <Input
            id="displayName"
            autoComplete="name"
            {...form.register("displayName")}
            disabled={busy}
            maxLength={100}
            aria-invalid={!!form.formState.errors.displayName}
            aria-describedby="displayName-help"
          />
          <p className="field-help error-text" id="displayName-help">
            {form.formState.errors.displayName
              ? "Enter a display name with 1–100 characters."
              : ""}
          </p>
        </div>
        <div>
          <label htmlFor="cohort">
            Cohort <span className="muted">(optional)</span>
          </label>
          <Input
            id="cohort"
            {...form.register("cohort")}
            disabled={busy}
            aria-invalid={!!form.formState.errors.cohort}
            aria-describedby="cohort-help"
          />
          <p
            className={`field-help ${form.formState.errors.cohort ? "error-text" : "muted"}`}
            id="cohort-help"
          >
            {form.formState.errors.cohort
              ? "Use M followed by two digits, for example M27."
              : "For example, M27. Leave blank to clear your cohort."}
          </p>
        </div>
        <div className="form-feedback">
          {!!failure && (
            <p role="alert" className="error-text">
              {errorMessage(failure)}
            </p>
          )}
          <p role="status">
            {saved && !form.formState.isDirty ? "Profile saved." : ""}
          </p>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty || busy}
            onClick={() =>
              unsaved.guard(() => {
                form.reset({
                  displayName: profile.displayName,
                  cohort: profile.cohort ?? "",
                });
                setFailure(undefined);
              })
            }
          >
            Cancel
          </Button>
          <Button type="submit" busy={busy} disabled={!form.formState.isDirty}>
            Save profile
          </Button>
        </div>
      </form>
      {unsaved.confirmation}
    </>
  );
}
export function Profile() {
  const session = useServices();
  const profile = useQuery({ ...session.meOptions, enabled: false }).data!;
  const location = useRouterState({ select: (state) => state.location });
  const navigate = useNavigate();
  const router = useRouter();
  const state = profileSearchSchema.parse(location.search);
  const page = state.page ?? 1;
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feed = useQuery(
    feedOptions(session, profile.id, {
      author: "me",
      page,
      limit: 20,
      sort: "newest",
    }),
  );
  const pages = Math.max(1, Math.ceil((feed.data?.total ?? 0) / 20));
  const correction = feed.isSuccess && page > pages;
  useEffect(() => {
    if (correction)
      void navigate({
        to: "/profile",
        search: { ...state, page: pages },
        replace: true,
        state: (previous) => previous,
        resetScroll: false,
      });
  }, [correction, navigate, pages, state]);
  function close() {
    if (location.state.atlasInsightOrigin) router.history.back();
    else
      void navigate({
        to: "/profile",
        search: { ...state, insight: undefined },
        replace: true,
        resetScroll: false,
      });
  }
  return (
    <section aria-labelledby="profile-heading">
      <h1
        className="profile-heading"
        id="profile-heading"
        ref={heading}
        tabIndex={-1}
      >
        My profile
      </h1>
      <p className="muted">How you appear to fellow Minervans.</p>
      <ProfileForm key={profile.id} profile={profile} />
      <section aria-labelledby="my-insights-heading" className="my-insights">
        <h2 id="my-insights-heading">My insights</h2>
        <p className="muted">
          Your contributions across all cities and General.
        </p>
        {feed.isError ? (
          <RequestState
            error={feed.error}
            retry={() => {
              void feed.refetch();
            }}
          />
        ) : feed.isPending || correction ? (
          <RequestState pendingLabel="Loading your insights…" />
        ) : feed.data.total === 0 ? (
          <div className="empty-state">
            <h3>No insights yet</h3>
            <p className="muted">
              Create an insight from Browse to share your advice.
            </p>
          </div>
        ) : (
          <>
            <p className="feed-caption" role="status">
              {feed.data.total.toLocaleString("en")}{" "}
              {feed.data.total === 1 ? "insight" : "insights"}
            </p>
            <InsightRows
              items={feed.data.items}
              open={(element) => {
                opener.current = element;
              }}
            />
            <InsightPagination
              page={page}
              total={feed.data.total}
              change={(next) => {
                void navigate({
                  to: "/profile",
                  search: { page: next },
                  resetScroll: false,
                });
              }}
            />
          </>
        )}
      </section>
      {state.insight && (
        <InsightDialog
          key={state.insight}
          id={state.insight}
          close={close}
          listLabel="My insights"
          restoreFocus={() => {
            if (opener.current?.isConnected)
              opener.current.focus({ preventScroll: true });
            else heading.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}
