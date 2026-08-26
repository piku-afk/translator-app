import { AppShell, Container } from "@mantine/core";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Header } from "#/components/header";
import { getCreditsQueryOptions } from "#/lib/credits";
import { getAuthState } from "#/lib/auth/session";

/**
 * Pathless layout protecting the private part of the app.
 *
 * Its loader runs on the server (SSR) and on client-side navigation:
 * unauthenticated access is redirected to /login before any private content
 * is rendered.
 */
export const Route = createFileRoute("/_app")({
  loader: async ({ context }) => {
    // getAuthState clears any stale/invalid session cookie when unauth'd, so
    // the operator lands on a clean login page.
    const { authenticated } = await getAuthState();

    if (!authenticated) {
      throw redirect({ to: "/login" });
    }

    context.queryClient.prefetchQuery(getCreditsQueryOptions());
  },
  component: function AppLayout() {
    return (
      <AppShell header={{ height: 60 }} padding="md">
        <Header />
        <AppShell.Main>
          <Container strategy="grid" className="py-6">
            <Outlet />
          </Container>
        </AppShell.Main>
      </AppShell>
    );
  },
});
