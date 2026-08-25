import "@fontsource-variable/geist/wght.css";
import {
  AppShell,
  ColorSchemeScript,
  Container,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Header } from "#/components/header";
import { getCreditsQueryOptions } from "#/lib/credits";

import "@mantine/core/styles.layer.css";
import appCss from "../styles.css?url";
import favicon from "../assets/favicon.svg";
import { theme } from "#/lib/mantine-theme";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Translator App" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      { rel: "icon", href: favicon },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        children: `
          (function () {
            try {
              var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
              if (tz && !document.cookie.match(/(^|;) *tz=([^;]*)/)) {
                document.cookie =
                  "tz=" + encodeURIComponent(tz) +
                  "; path=/; max-age=31536000; SameSite=Lax";
              }
            } catch (e) {}
          })();
        `,
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(getCreditsQueryOptions());
  },
  component: function RootComponent() {
    const { queryClient } = Route.useRouteContext();
    return (
      <QueryClientProvider client={queryClient}>
        <RootDocument>
          <Outlet />
        </RootDocument>
        <ReactQueryDevtools />
        <TanStackRouterDevtools />
      </QueryClientProvider>
    );
  },
});

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <AppShell header={{ height: 60 }} padding="md">
            <Header />
            <AppShell.Main>
              <Container strategy="grid" className="py-6">
                {children}
              </Container>
            </AppShell.Main>
          </AppShell>
        </MantineProvider>
        <Scripts />
      </body>
    </html>
  );
}
