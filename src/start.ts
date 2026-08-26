/**
 * TanStack Start instance configuration.
 *
 * Defining a custom `startInstance` replaces the built-in default middleware
 * list, so the standard CSRF middleware for server functions must be included
 * explicitly (same filter as the built-in default).
 *
 * The auth middleware below is the app-wide, reusable server-side guard:
 * - Page navigations (requests the router renders, `Accept: text/html`) to
 *   non-public paths are redirected to `/login` when there is no valid session.
 *   This runs on the server during SSR, so unauthenticated users never receive
 *   the HTML of a private page.
 * - API requests (`/api/*`) receive a 401 when unauthenticated.
 * - Server functions are intentionally not blocked here; every server function
 *   that accesses private data independently calls `requireAuth()` (see
 *   src/lib/auth/session.ts).
 *
 * Static asset requests (which may be routed through the worker in development)
 * are passed through untouched.
 */
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { isAuthenticated, endSession } from "#/lib/auth/session.server";

const PUBLIC_PATHS = new Set(["/login"]);

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isHtmlNavigation(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.split(",").some((part) => (part.split(";")[0]?.trim() ?? "") === "text/html");
}

const authMiddleware = createMiddleware().server(
  async ({ request, pathname, handlerType, next }) => {
    if (handlerType !== "router") {
      return next();
    }

    if (PUBLIC_PATHS.has(normalizePathname(pathname))) {
      return next();
    }

    const isApiRequest = pathname.startsWith("/api/");
    if (!isApiRequest && !isHtmlNavigation(request)) {
      return next();
    }

    if (await isAuthenticated()) {
      return next();
    }

    if (isApiRequest) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Clear any stale/invalid session cookie before sending the operator to
    // the login page.
    await endSession();
    return new Response(null, { status: 303, headers: { location: "/login" } });
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === "serverFn",
    }),
    authMiddleware,
  ],
}));
