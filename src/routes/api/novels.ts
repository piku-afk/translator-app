import { createFileRoute } from '@tanstack/react-router'
import { fetchNovels } from '../../lib/mock-data'

export const Route = createFileRoute('/api/novels')({
  server: {
    handlers: {
      GET: async () => Response.json(await fetchNovels()),
    },
  },
})