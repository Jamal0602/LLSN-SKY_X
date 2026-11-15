import { forwardJsonRequest } from '../../lib/serverProxy.js'

const allowedLayers = new Set([
  'LRO_LOLA_DEM_SPole45_100mp_v04',
  'LRO_LOLA_DEM_Global_256ppd_v06',
])
const allowedParameters = [
  'geometry',
  'geometryType',
  'returnGeometry',
  'returnCatalogItems',
  'f',
]

export default function handler(request, response) {
  const path = request.query?.path
  const segments = Array.isArray(path) ? path : typeof path === 'string' ? path.split('/') : []
  const [layer, service, operation] = segments
  if (!allowedLayers.has(layer) || service !== 'ImageServer' || operation !== 'identify' || segments.length !== 3) {
    return response.status(404).json({ error: 'Unknown lunar elevation endpoint.' })
  }

  const incoming = new URL(request.url, 'http://localhost')
  const parameters = new URLSearchParams()
  allowedParameters.forEach((parameter) => {
    const value = incoming.searchParams.get(parameter)
    if (value !== null) parameters.set(parameter, value)
  })

  let geometry
  try {
    geometry = JSON.parse(parameters.get('geometry') || '')
  } catch {
    return response.status(400).json({ error: 'A valid point geometry is required.' })
  }
  if (!Number.isFinite(geometry.x) || !Number.isFinite(geometry.y)
      || geometry.x < -180 || geometry.x > 180 || geometry.y < -90 || geometry.y > 90) {
    return response.status(400).json({ error: 'The elevation coordinate is outside the Moon coordinate range.' })
  }

  const query = parameters.toString()
  const upstream = new URL(
    `https://trek.nasa.gov/moon/trekarcgis/rest/services/${layer}/${service}/${operation}?${query}`,
  )
  return forwardJsonRequest(request, response, upstream, 3600)
}
