import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

/**
 * Cloudflare augments the incoming worker request with a `cf` object (see
 * `worker-configuration.d.ts`), exposing the client's IANA timezone via
 * `cf.timezone`. The global `Request` type used by the server entry doesn't
 * include it, so narrow it here.
 */
type CfRequest = Request & { cf?: { timezone?: string } };

export default createServerEntry({
  fetch(incomingRequest) {
    const url = new URL(incomingRequest.url);
    const request = new Request(url, incomingRequest);

    // `new Request()` does not copy the `cf` object across, so thread the
    // timezone through as a header the app reads when deriving the greeting's
    // local time. Absent (dev, unknown geo) -> falls back to UTC further down.
    const timezone = (incomingRequest as CfRequest).cf?.timezone;
    if (timezone) {
      request.headers.set("x-timezone", timezone);
    }

    return handler.fetch(request);
  },
});
