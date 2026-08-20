import { createFileRoute } from '@tanstack/react-router'
import { fetchActivity } from '../../lib/mock-data'

export const Route = createFileRoute('/api/activity')({
  server: {
    handlers: {
      GET: async () => Response.json(await fetchActivity()),
    },
  },
})