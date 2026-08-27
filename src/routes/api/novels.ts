import { createFileRoute } from "@tanstack/react-router";
import { isAuthenticated } from "#/lib/auth/session.server";
import { getTranslatorService } from "#/lib/novels/novels.server";

export const Route = createFileRoute("/api/novels")({
  server: {
    handlers: {
      GET: async () => {
        // Independent auth check: this endpoint must not serve private data
        // without a valid session, regardless of route-level guards.
        if (!(await isAuthenticated())) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const novels = await getTranslatorService().listNovels();
        return Response.json(novels);
      },
    },
  },
});
