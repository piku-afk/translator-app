import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
  fetch(incomingRequest) {
    const url = new URL(incomingRequest.url);
    const request = new Request(url, incomingRequest);
    request.headers.delete("cf-workers-preview-token");

    return handler.fetch(request);
  },
});
