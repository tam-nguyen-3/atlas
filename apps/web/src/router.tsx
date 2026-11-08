import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  Outlet,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Compass, Sparkles } from "lucide-react";
import { z } from "zod";
import { NavigationSheet } from "@/components/ui/sheet";
import { RequestState } from "@/components/ui/request-state";
import { useServices } from "./lib/app-context";
import { safeReturnTo } from "./lib/auth-validation";
import type { Session } from "./lib/session";
import { AuthScreen } from "./auth-screen";
import { Browse } from "./browse";
import { Profile } from "./profile";
import { ContributionProvider } from "./components/contribution";
import { AccountMenu } from "./components/account-menu";
import {
  browseSearchSchema,
  profileSearchSchema,
  parseRouteSearch,
  stringifyRouteSearch,
} from "./lib/browse-state";

const searchSchema = z
  .object({
    city: z.string().catch("").optional(),
    returnTo: z.unknown().optional(),
  })
  .catchall(z.unknown());
const links = [
  { to: "/browse", label: "Browse", icon: BookOpen },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/agent", label: "Agent", icon: Sparkles },
] as const;
function Brand() {
  return (
    <Link
      to="/browse"
      search={(previous) => {
        const search = { ...previous };
        delete search.returnTo;
        return search;
      }}
      className="wordmark"
      aria-label="Atlas home"
    >
      <span className="brand-mark" aria-hidden="true" />
      atlas
      <span className="wordmark-dot" aria-hidden="true" />
    </Link>
  );
}
function Navigation({ close }: { close?: () => void }) {
  return (
    <>
      <nav aria-label="Main navigation">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            search={(previous) => previous}
            activeOptions={{ exact: true, includeSearch: false }}
            activeProps={{
              className: "nav-link active",
              "aria-current": "page",
            }}
            inactiveProps={{ className: "nav-link" }}
            onClick={close}
          >
            <Icon size={19} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      <AccountMenu closeNavigation={close} />
    </>
  );
}
function Frame({
  authenticated = false,
  children,
}: {
  authenticated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <Brand />
          {authenticated && (
            <>
              <div className="desktop-nav">
                <Navigation />
              </div>
              <NavigationSheet>
                {(close) => <Navigation close={close} />}
              </NavigationSheet>
            </>
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="main">
        {children}
      </main>
      <footer className="app-footer">
        <span>Made for the way we move.</span>
        <span>Minerva Atlas</span>
      </footer>
    </>
  );
}
function ProtectedLayout() {
  const session = useServices();
  const router = useRouter();
  const location = useRouterState({ select: (state) => state.location });
  const navigationStatus = useRouterState({ select: (state) => state.status });
  const me = useQuery({ ...session.meOptions, refetchOnMount: false });
  const returnTo = safeReturnTo(location.href);
  const signedOut = me.data === null;
  useEffect(() => {
    if (signedOut && navigationStatus === "idle")
      void router.navigate({
        to: "/sign-in",
        search: { returnTo },
        replace: true,
      });
  }, [signedOut, navigationStatus, returnTo, router]);
  useEffect(() => {
    document.title = `${location.pathname === "/profile" ? "My profile" : (links.find((link) => link.to === location.pathname)?.label ?? "Atlas")} · Minerva Atlas`;
  }, [location.pathname]);
  if (me.isError)
    return (
      <Frame>
        <RequestState
          error={me.error}
          retry={() => {
            void me.refetch();
          }}
        />
      </Frame>
    );
  if (me.isPending)
    return (
      <Frame>
        <RequestState pendingLabel="Confirming your session…" />
      </Frame>
    );
  if (!me.data)
    return (
      <Frame>
        <RequestState pendingLabel="Returning to sign in…" />
      </Frame>
    );
  return (
    <Frame authenticated>
      <ContributionProvider key={me.data.id}>
        <Outlet />
      </ContributionProvider>
      {router.state.status === "pending" && (
        <p className="navigation-status" role="status">
          Loading page…
        </p>
      )}
    </Frame>
  );
}
function ProtectedError() {
  const session = useServices();
  const router = useRouter();
  const me = session.queryClient.getQueryState(session.meOptions.queryKey);
  return (
    <Frame>
      <RequestState
        error={me?.error ?? new Error("Session lookup failed")}
        retry={() => {
          void router.invalidate();
        }}
      />
    </Frame>
  );
}
function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="placeholder">
      <p className="eyebrow">MINERVA ATLAS</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
      <Link to="/browse" search={(previous) => previous} className="text-link">
        Back to Browse
      </Link>
    </section>
  );
}
const rootRoute = createRootRouteWithContext<{ session: Session }>()({
  component: Outlet,
  validateSearch: (input) => searchSchema.parse(input),
  notFoundComponent: () => (
    <Frame>
      <Placeholder
        title="Page not found"
        description="This page isn’t available. Return to Browse to find your way."
      />
    </Frame>
  ),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ search }) =>
    redirect({ to: "/browse", search, replace: true }),
});
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  beforeLoad: async ({ context, location }) => {
    const profile = await context.session.verify();
    if (!profile)
      return redirect({
        to: "/sign-in",
        search: { returnTo: safeReturnTo(location.href) },
        replace: true,
      });
  },
  component: ProtectedLayout,
  pendingComponent: () => (
    <Frame>
      <RequestState pendingLabel="Confirming your session…" />
    </Frame>
  ),
  errorComponent: ProtectedError,
  // Recheck the parent when moving between its child routes.
  staleTime: 0,
});
export const browseRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/browse",
  validateSearch: browseSearchSchema,
  component: Browse,
});
const discoverRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/discover",
  component: () => (
    <Placeholder
      title="Discover"
      description="A little more of your city, coming soon."
    />
  ),
});
const agentRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/agent",
  component: () => (
    <Placeholder
      title="Agent"
      description="Your next chapter of city exploration, coming soon."
    />
  ),
});
const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: "/profile",
  validateSearch: profileSearchSchema,
  component: Profile,
});
const authRoutes = (["sign-in", "sign-up"] as const).map((mode) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: `/${mode}`,
    component: () => (
      <Frame>
        <AuthScreen key={mode} mode={mode} />
      </Frame>
    ),
  }),
);
export function createAppRouter(session: Session) {
  const router = createRouter({
    scrollRestoration: true,
    parseSearch: parseRouteSearch,
    stringifySearch: stringifyRouteSearch,
    routeTree: rootRoute.addChildren([
      indexRoute,
      ...authRoutes,
      protectedRoute.addChildren([
        browseRoute,
        discoverRoute,
        agentRoute,
        profileRoute,
      ]),
    ]),
    context: { session },
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
  // Invalidate cached route matches without reloading the current protected page:
  // the null /me state redirects it. A reload here could revive a rejected session.
  session.setRouteInvalidator(() => {
    router.clearCache();
  });
  return router;
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
