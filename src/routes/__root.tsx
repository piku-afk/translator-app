import "@fontsource-variable/geist/wght.css";
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";

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
  }),
  component: function RootComponent() {
    const { queryClient } = Route.useRouteContext();
    return (
      <QueryClientProvider client={queryClient}>
        <html lang="en" {...mantineHtmlProps}>
          <head>
            <ColorSchemeScript />
            <HeadContent />
          </head>
          <body>
            <MantineProvider theme={theme}>
              <Outlet />
            </MantineProvider>
            <Scripts />
          </body>
        </html>
        <TanStackDevtools
          config={{ position: "bottom-left" }}
          plugins={[
            { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
            { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
          ]}
        />
      </QueryClientProvider>
    );
  },
});
