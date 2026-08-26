import { createFileRoute } from "@tanstack/react-router";
import { fetchActivity } from "../../lib/mock-data";
import { isAuthenticated } from "#/lib/auth/session.server";

export const Route = createFileRoute("/api/activity")({
  server: {
    handlers: {
      GET: async () => {
        // Independent auth check: this endpoint must not serve private data
        // without a valid session, regardless of route-level guards.
        if (!(await isAuthenticated())) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return Response.json(await fetchActivity());
      },
    },
  },
});
