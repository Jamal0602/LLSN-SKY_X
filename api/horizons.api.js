import { forwardJsonRequest } from '../lib/serverProxy.js'

const allowedParameters = [
  'format',
  'COMMAND',
  'CENTER',
  'COORD_TYPE',
  'SITE_COORD',
  'MAKE_EPHEM',
  'EPHEM_TYPE',
  'START_TIME',
  'STOP_TIME',
  'STEP_SIZE',
  'QUANTITIES',
]

export default function handler(request, response) {
  const incoming = new URL(request.url, 'http://localhost')
  const upstream = new URL('https://ssd.jpl.nasa.gov/api/horizons.api')
  allowedParameters.forEach((parameter) => {
    const value = incoming.searchParams.get(parameter)
    if (value !== null) upstream.searchParams.set(parameter, value)
  })

  return forwardJsonRequest(request, response, upstream)
}
