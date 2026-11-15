import { forwardJsonRequest } from '../../../lib/serverProxy.js'

export default function handler(request, response) {
  const incoming = new URL(request.url, 'http://localhost')
  const requestedLimit = Number(incoming.searchParams.get('limit') || 100)
  const search = (incoming.searchParams.get('search') || 'lunar').trim()
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100 || search.length > 80) {
    return response.status(400).json({ error: 'Invalid launch schedule query.' })
  }

  const parameters = new URLSearchParams({
    limit: String(requestedLimit),
    search,
  })
  const upstream = new URL(`https://ll.thespacedevs.com/2.2.0/launch/upcoming/?${parameters}`)
  return forwardJsonRequest(request, response, upstream, 600)
}
