export async function forwardJsonRequest(request, response, upstreamUrl, cacheSeconds = 300) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Only GET requests are supported.' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const body = await upstream.text()
    const contentType = upstream.headers.get('content-type')
    if (contentType) response.setHeader('Content-Type', contentType)
    response.setHeader(
      'Cache-Control',
      upstream.ok ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=300` : 'no-store',
    )
    return response.status(upstream.status).send(body)
  } catch (error) {
    const timedOut = controller.signal.aborted
    console.error(`Upstream request failed for ${upstreamUrl.pathname}:`, error)
    return response.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'The upstream data service timed out.' : 'The upstream data service is unavailable.',
    })
  } finally {
    clearTimeout(timeout)
  }
}
