import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import moonTextureUrl from '../data/source-image/nasa-lro-wac-global.png'
import { candidateSites, missionImages, missions } from './data/lunarData'
import './App.css'

const MOON_RADIUS_KM = 1737.4
const PLANNING_HOURS = 720
const initialTarget = candidateSites.find((site) => site.id === 'shackleton-connecting-ridge')

function utcInputValue(date) {
  return date.toISOString().slice(0, 16)
}

function parseUtcInput(value) {
  return new Date(`${value}:00Z`)
}

function horizonDate(date) {
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)}`
}

function formatUtc(date) {
  if (!date || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatCoordinate(value, isLatitude) {
  const hemisphere = isLatitude
    ? (value < 0 ? 'S' : 'N')
    : (value < 0 ? 'W' : 'E')
  return `${Math.abs(value).toFixed(4)}° ${hemisphere}`
}

function solarDiskFraction(altitude) {
  const radius = 0.266
  if (altitude <= -radius) return 0
  if (altitude >= radius) return 1
  const ratio = altitude / radius
  return (Math.asin(ratio) + ratio * Math.sqrt(1 - ratio * ratio) + Math.PI / 2) / Math.PI
}

function observerRows(payload, label) {
  if (payload.error) throw new Error(payload.error)
  const table = payload.result?.split('$$SOE')[1]?.split('$$EOE')[0]
  if (!table) throw new Error(`JPL Horizons returned no ${label} ephemeris rows.`)
  const rows = table.split(/\r?\n/).flatMap((line) => {
    if (!/^\s*\d{4}-[A-Z][a-z]{2}-\d{2}/.test(line)) return []
    const values = line.trim().replace(/\s+\*\s+/, ' ').split(/\s+/)
    const azimuth = Number(values[2])
    const elevation = Number(values[3])
    if (!Number.isFinite(azimuth) || !Number.isFinite(elevation)) return []
    return [{ azimuth, elevation }]
  })
  if (rows.length === 0) throw new Error(`JPL Horizons returned unreadable ${label} ephemeris data.`)
  return rows
}

async function requestHorizons(body, target, start, signal) {
  const stop = new Date(start.getTime() + PLANNING_HOURS * 60 * 60 * 1000)
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: `'${body}'`,
    CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${target.lon},${target.lat},0'`,
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    START_TIME: `'${horizonDate(start)}'`,
    STOP_TIME: `'${horizonDate(stop)}'`,
    STEP_SIZE: "'1h'",
    QUANTITIES: "'4,20'",
  })
  const response = await fetch(`/api/horizons.api?${params}`, { signal })
  if (!response.ok) throw new Error(`JPL Horizons request failed (${response.status}).`)
  return observerRows(await response.json(), body === '10' ? 'Sun' : 'Earth')
}

async function requestLolaElevation(target, signal) {
  const layer = target.lat <= -45
    ? 'LRO_LOLA_DEM_SPole45_100mp_v04'
    : 'LRO_LOLA_DEM_Global_256ppd_v06'
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: target.lon, y: target.lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    returnGeometry: 'false',
    returnCatalogItems: 'false',
    f: 'json',
  })
  const response = await fetch(`/api/moon-dem/${layer}/ImageServer/identify?${params}`, { signal })
  if (!response.ok) throw new Error(`NASA LOLA request failed (${response.status}).`)
  const result = await response.json()
  if (result.error) throw new Error(result.error.message || 'NASA LOLA could not sample this coordinate.')
  const value = Number(result.value)
  if (!Number.isFinite(value)) throw new Error('NASA LOLA returned no elevation sample for this coordinate.')
  return { meters: value, layer }
}

function coordinateVector(latitude, longitude) {
  const lat = THREE.MathUtils.degToRad(latitude)
  const lon = THREE.MathUtils.degToRad(longitude)
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.sin(lat),
    -Math.cos(lat) * Math.sin(lon),
  ).normalize()
}

function localCelestialVector(latitude, longitude, azimuth, elevation) {
  const lat = THREE.MathUtils.degToRad(latitude)
  const lon = THREE.MathUtils.degToRad(longitude)
  const az = THREE.MathUtils.degToRad(azimuth)
  const el = THREE.MathUtils.degToRad(elevation)
  const up = coordinateVector(latitude, longitude)
  const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon))
  const north = new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), Math.cos(lat), Math.sin(lat) * Math.sin(lon))
  return up.multiplyScalar(Math.sin(el))
    .add(east.multiplyScalar(Math.cos(el) * Math.sin(az)))
    .add(north.multiplyScalar(Math.cos(el) * Math.cos(az)))
    .normalize()
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children[0]
    group.remove(child)
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose()
      if (node.material) {
        const materials = Array.isArray(node.material) ? node.material : [node.material]
        materials.forEach((material) => material.dispose())
      }
    })
  }
}

function MoonGlobe({ target, sites, missionData, sun, earth, landingRun, isAutoRotate, onResetRef }) {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const targetRef = useRef(target)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#070a12')
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30)
    camera.position.set(0.1, 0.16, 3.05)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05

    const ambient = new THREE.AmbientLight('#aeb9d1', 1.65)
    scene.add(ambient)
    const sunLight = new THREE.DirectionalLight('#fff0d3', 2.15)
    sunLight.position.set(3, 1, 2)
    scene.add(sunLight)

    const moonGeometry = new THREE.SphereGeometry(1, 160, 112)
    const moonTexture = new THREE.TextureLoader().load(moonTextureUrl)
    moonTexture.colorSpace = THREE.SRGBColorSpace
    const moonMaterial = new THREE.MeshStandardMaterial({
      map: moonTexture,
      roughness: 0.94,
      metalness: 0,
    })
    const moon = new THREE.Mesh(moonGeometry, moonMaterial)
    scene.add(moon)

    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(1.015, 96, 72),
      new THREE.MeshBasicMaterial({ color: '#b7c8e8', transparent: true, opacity: 0.055, side: THREE.BackSide }),
    )
    scene.add(rim)

    const starGeometry = new THREE.BufferGeometry()
    const starPositions = new Float32Array(900 * 3)
    for (let index = 0; index < starPositions.length; index += 3) {
      const direction = new THREE.Vector3().randomDirection().multiplyScalar(5 + Math.random() * 4)
      starPositions[index] = direction.x
      starPositions[index + 1] = direction.y
      starPositions[index + 2] = direction.z
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#c4cce1', size: 0.012, transparent: true, opacity: 0.72 })))

    const markerGroup = new THREE.Group()
    const celestialGroup = new THREE.Group()
    const landingGroup = new THREE.Group()
    scene.add(markerGroup, celestialGroup, landingGroup)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.055
    controls.enablePan = false
    controls.minDistance = 1.55
    controls.maxDistance = 4.8
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.22

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const width = Math.max(bounds.width, 1)
      const height = Math.max(bounds.height, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    const state = {
      scene,
      camera,
      renderer,
      controls,
      moon,
      sunLight,
      markerGroup,
      celestialGroup,
      landingGroup,
      animation: null,
    }
    sceneRef.current = state
    onResetRef.current = () => {
      camera.position.set(0.1, 0.16, 3.05)
      controls.target.set(0, 0, 0)
      controls.autoRotate = true
      controls.update()
    }

    let frame = 0
    const renderFrame = (now) => {
      frame = window.requestAnimationFrame(renderFrame)
      if (state.animation) {
        const progress = Math.min((now - state.animation.start) / state.animation.duration, 1)
        const eased = 1 - ((1 - progress) ** 2)
        state.animation.lander.position.copy(state.animation.curve.getPoint(eased))
        const direction = state.animation.curve.getTangent(eased).normalize()
        state.animation.lander.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
        if (progress >= 1) state.animation = null
      }
      controls.update()
      renderer.render(scene, camera)
    }
    renderFrame(0)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      controls.dispose()
      clearGroup(markerGroup)
      clearGroup(celestialGroup)
      clearGroup(landingGroup)
      moonGeometry.dispose()
      moonTexture.dispose()
      moonMaterial.dispose()
      rim.geometry.dispose()
      rim.material.dispose()
      starGeometry.dispose()
      renderer.dispose()
      sceneRef.current = null
      onResetRef.current = null
    }
  }, [onResetRef])

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.controls.autoRotate = isAutoRotate
  }, [isAutoRotate])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    targetRef.current = target
    clearGroup(state.markerGroup)
    clearGroup(state.landingGroup)
    state.animation = null

    const currentVector = coordinateVector(target.lat, target.lon)
    const addMarker = (latitude, longitude, color, size, selected = false) => {
      const normal = coordinateVector(latitude, longitude)
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(size, 12, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: selected ? 1 : 0.78 }),
      )
      dot.position.copy(normal).multiplyScalar(selected ? 1.018 : 1.006)
      state.markerGroup.add(dot)
      if (selected) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.025, 0.0025, 6, 48),
          new THREE.MeshBasicMaterial({ color: '#f1cc86', transparent: true, opacity: 0.9 }),
        )
        ring.position.copy(normal).multiplyScalar(1.012)
        ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
        state.markerGroup.add(ring)
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0015, 0.0015, 0.045, 5),
          new THREE.MeshBasicMaterial({ color: '#f1cc86' }),
        )
        stem.position.copy(normal).multiplyScalar(1.038)
        stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal)
        state.markerGroup.add(stem)
      }
    }

    sites.forEach((site) => addMarker(site.lat, site.lon, '#73d9c0', 0.008, false))
    missionData.forEach((mission) => {
      if (Number.isFinite(mission.lat) && Number.isFinite(mission.lon)) {
        addMarker(mission.lat, mission.lon, '#8a9ab8', 0.0055, false)
      }
    })
    addMarker(target.lat, target.lon, '#ffd88c', 0.009, true)
    state.targetVector = currentVector
  }, [target, sites, missionData])

  useEffect(() => {
    const state = sceneRef.current
    if (!state) return
    clearGroup(state.celestialGroup)
    if (!sun || !earth) return

    const normal = coordinateVector(target.lat, target.lon)
    const sunVector = localCelestialVector(target.lat, target.lon, sun.azimuth, sun.elevation)
    const earthVector = localCelestialVector(target.lat, target.lon, earth.azimuth, earth.elevation)
    state.sunLight.position.copy(sunVector).multiplyScalar(4)

    const addBody = (vector, color) => {
      const point = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 12, 10),
        new THREE.MeshBasicMaterial({ color, toneMapped: false }),
      )
      point.position.copy(normal).multiplyScalar(1.025).add(vector.multiplyScalar(0.2))
      state.celestialGroup.add(point)
      const ray = new THREE.BufferGeometry().setFromPoints([
        normal.clone().multiplyScalar(1.004),
        point.position,
      ])
      state.celestialGroup.add(new THREE.Line(ray, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.42 })))
    }
    addBody(sunVector, '#ffd078')
    addBody(earthVector, '#82cfff')
  }, [target, sun, earth])

  useEffect(() => {
    const state = sceneRef.current
    if (!state || landingRun === 0) return
    clearGroup(state.landingGroup)
    const currentTarget = targetRef.current
    const normal = coordinateVector(currentTarget.lat, currentTarget.lon)
    const lon = THREE.MathUtils.degToRad(currentTarget.lon)
    const east = new THREE.Vector3(-Math.sin(lon), 0, -Math.cos(lon)).normalize()
    const curve = new THREE.CatmullRomCurve3([
      normal.clone().multiplyScalar(2.55).add(east.clone().multiplyScalar(0.42)),
      normal.clone().multiplyScalar(1.92).add(east.clone().multiplyScalar(0.28)),
      normal.clone().multiplyScalar(1.38).add(east.clone().multiplyScalar(0.11)),
      normal.clone().multiplyScalar(1.025),
    ])
    const route = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),
      new THREE.LineDashedMaterial({ color: '#ffe0a2', dashSize: 0.035, gapSize: 0.018, transparent: true, opacity: 0.85 }),
    )
    route.computeLineDistances()
    state.landingGroup.add(route)

    const lander = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.025, 0.075, 5),
      new THREE.MeshStandardMaterial({ color: '#e8d6b1', metalness: 0.45, roughness: 0.4 }),
    )
    body.rotation.x = Math.PI
    lander.add(body)
    const light = new THREE.PointLight('#ffd18c', 0.45, 0.25)
    lander.add(light)
    lander.position.copy(curve.getPoint(0))
    state.landingGroup.add(lander)
    state.animation = { curve, lander, start: performance.now(), duration: 4600 }
  }, [landingRun])

  return <canvas className="moon-canvas" ref={canvasRef} aria-label={`Interactive 3D lunar globe centered on ${target.name}`} />
}

function ElevationChart({ sunRows, earthRows, hour }) {
  const width = 900
  const height = 145
  const pad = 12
  const min = -12
  const max = 18
  const y = (value) => pad + ((max - value) / (max - min)) * (height - pad * 2)
  const line = (rows) => rows.map((row, index) => {
    const x = pad + (index / Math.max(rows.length - 1, 1)) * (width - pad * 2)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y(row.elevation).toFixed(2)}`
  }).join(' ')
  const markerX = pad + (hour / PLANNING_HOURS) * (width - pad * 2)

  return (
    <svg className="ephemeris-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Thirty day JPL Horizons Sun and Earth elevations">
      {[-10, 0, 10].map((value) => (
        <g key={value}>
          <line x1={pad} x2={width - pad} y1={y(value)} y2={y(value)} className={value === 0 ? 'chart-zero' : 'chart-grid'} />
          <text x={pad} y={y(value) - 4} className="chart-tick">{value}°</text>
        </g>
      ))}
      {sunRows.length > 0 && <path d={line(sunRows)} className="sun-path" />}
      {earthRows.length > 0 && <path d={line(earthRows)} className="earth-path" />}
      <line x1={markerX} x2={markerX} y1={pad} y2={height - pad} className="time-cursor" />
    </svg>
  )
}

function App() {
  const [target, setTarget] = useState(initialTarget)
  const [latitudeInput, setLatitudeInput] = useState(String(initialTarget.lat))
  const [longitudeInput, setLongitudeInput] = useState(String(initialTarget.lon))
  const [customError, setCustomError] = useState('')
  const [startTime, setStartTime] = useState(() => utcInputValue(new Date()))
  const [hour, setHour] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [refreshId, setRefreshId] = useState(0)
  const [ephemeris, setEphemeris] = useState({ key: '', status: 'loading', sun: [], earth: [], error: '' })
  const [elevation, setElevation] = useState({ key: '', status: 'loading', meters: null, layer: '', error: '' })
  const [missionId, setMissionId] = useState('')
  const [missionSearch, setMissionSearch] = useState('')
  const [missionNotice, setMissionNotice] = useState('')
  const [landingRun, setLandingRun] = useState(0)
  const [landingStatus, setLandingStatus] = useState('')
  const [isAutoRotate, setIsAutoRotate] = useState(true)
  const descentTimeout = useRef(0)
  const resetViewRef = useRef(null)

  const selectedMission = useMemo(() => missions.find((mission) => mission.id === missionId), [missionId])
  const requestKey = `${target.id}|${target.lat}|${target.lon}|${startTime}|${refreshId}`
  const ephemerisStatus = ephemeris.key === requestKey ? ephemeris.status : 'loading'
  const ephemerisError = ephemeris.key === requestKey ? ephemeris.error : ''
  const elevationStatus = elevation.key === requestKey ? elevation.status : 'loading'
  const elevationError = elevation.key === requestKey ? elevation.error : ''
  const selectedDate = useMemo(() => {
    const start = parseUtcInput(startTime)
    return new Date(start.getTime() + hour * 60 * 60 * 1000)
  }, [startTime, hour])
  const sun = ephemerisStatus === 'live' ? ephemeris.sun[hour] : undefined
  const earth = ephemerisStatus === 'live' ? ephemeris.earth[hour] : undefined
  const filteredMissions = useMemo(() => {
    const query = missionSearch.trim().toLowerCase()
    return missions.filter((mission) => !query
      || mission.name.toLowerCase().includes(query)
      || mission.agency.toLowerCase().includes(query)
      || String(mission.year).includes(query))
  }, [missionSearch])
  const sitesAndMissions = useMemo(() => [
    ...candidateSites,
    ...missions.filter((mission) => Number.isFinite(mission.lat) && Number.isFinite(mission.lon))
      .map((mission) => ({ ...mission, id: `mission-${mission.id}` })),
  ], [])
  const daylightFraction = sun ? solarDiskFraction(sun.elevation) : 0

  useEffect(() => {
    const start = parseUtcInput(startTime)
    if (Number.isNaN(start.getTime())) return undefined
    const controller = new AbortController()

    Promise.all([
      requestHorizons('10', target, start, controller.signal),
      requestHorizons('399', target, start, controller.signal),
    ]).then(([sunRows, earthRows]) => {
      if (!controller.signal.aborted) {
        setEphemeris({ key: requestKey, status: 'live', sun: sunRows, earth: earthRows, error: '' })
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setEphemeris({ key: requestKey, status: 'error', sun: [], earth: [], error: error.message })
      }
    })

    requestLolaElevation(target, controller.signal).then((sample) => {
      if (!controller.signal.aborted) {
        setElevation({ key: requestKey, status: 'live', meters: sample.meters, layer: sample.layer, error: '' })
      }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setElevation({ key: requestKey, status: 'error', meters: null, layer: '', error: error.message })
      }
    })

    return () => controller.abort()
  }, [target, startTime, refreshId, requestKey])

  useEffect(() => {
    if (!playing || ephemerisStatus !== 'live') return undefined
    const timer = window.setInterval(() => {
      setHour((current) => {
        if (current >= PLANNING_HOURS) {
          setPlaying(false)
          return PLANNING_HOURS
        }
        return current + 1
      })
    }, 140)
    return () => window.clearInterval(timer)
  }, [playing, ephemerisStatus])

  useEffect(() => () => window.clearTimeout(descentTimeout.current), [])

  const chooseTarget = (id) => {
    const next = sitesAndMissions.find((item) => item.id === id)
    if (next) {
      setTarget(next)
      setLatitudeInput(String(next.lat))
      setLongitudeInput(String(next.lon))
      setHour(0)
      setMissionNotice('')
    }
  }

  const applyCustomCoordinates = (event) => {
    event.preventDefault()
    const lat = Number(latitudeInput)
    const lon = Number(longitudeInput)
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setCustomError('Latitude must be between −90° and +90°.')
      return
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setCustomError('East-positive longitude must be between −180° and +180°.')
      return
    }
    setCustomError('')
    setTarget({ id: `custom-${lat}-${lon}`, name: 'Custom coordinates', lat, lon, payload: 'No mission payload record for custom coordinates.' })
    setHour(0)
    setMissionNotice('')
  }

  const chooseMission = (mission) => {
    setMissionId(mission.id)
    if (Number.isFinite(mission.lat) && Number.isFinite(mission.lon)) {
      const missionTarget = { ...mission, id: `mission-${mission.id}`, payload: mission.coordinateSource }
      setTarget(missionTarget)
      setHour(0)
      setMissionNotice(`Map focus set to the NASA Moon Trek ${mission.event?.toLowerCase() || 'landing'} record.`)
    } else {
      setMissionNotice(`${mission.type} record has no surface coordinate in the NASA Moon Trek layers; the current target remains selected.`)
    }
  }

  const runDescent = () => {
    setLandingRun((run) => run + 1)
    setLandingStatus('DESCENT ANIMATION')
    window.clearTimeout(descentTimeout.current)
    descentTimeout.current = window.setTimeout(() => setLandingStatus('LANDED AT SELECTED COORDINATE'), 4700)
  }

  const selectedSiteValue = sitesAndMissions.some((item) => item.id === target.id) ? target.id : ''
  const resourceText = target.lat <= -70
    ? 'Polar volatile prospecting region'
    : 'No polar volatile estimate for this latitude'

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="SELENE home">
          <span className="brand-symbol"><i /><i /><i /></span>
          <span><strong>SELENE</strong><small>LUNAR LANDING SITE NAVIGATOR</small></span>
        </a>
        <div className="header-status">
          <span className={`service-indicator ${ephemerisStatus}`} />
          {ephemerisStatus === 'live' ? 'JPL LIVE EPHEMERIS' : ephemerisStatus === 'loading' ? 'CONNECTING TO JPL' : 'JPL DATA UNAVAILABLE'}
        </div>
        <nav className="source-nav" aria-label="Data sources">
          <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noreferrer">MOON TREK ↗</a>
          <a href="https://quickmap.lroc.im-ldi.com/" target="_blank" rel="noreferrer">LROC QUICKMAP ↗</a>
          <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">JPL HORIZONS ↗</a>
          <a className="csa-link" href="https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/" target="_blank" rel="noreferrer">CSA ↗</a>
        </nav>
      </header>

      <section className="intro-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-mark" /> LUNAR OPERATIONS / SITE INTELLIGENCE</div>
          <h1>Choose a place.<br /><em>See the Moon in motion.</em></h1>
          <p>NASA terrain, historical landing records, and live JPL observer geometry—at one coordinate and time.</p>
        </div>
        <div className="mission-clock">
          <span>SIMULATION EPOCH · UTC</span>
          <strong>{formatUtc(selectedDate)}</strong>
          <small>{String(hour).padStart(3, '0')} / 720 HOUR SAMPLES</small>
        </div>
      </section>

      <section className="workbench">
        <div className="globe-panel">
          <div className="globe-topline">
            <div className="globe-heading"><span className="live-dot" /> LIVE LUNAR GLOBE <i>·</i> LRO WAC</div>
            <span className="model-badge">IAU MOON · R = {MOON_RADIUS_KM.toLocaleString()} KM</span>
          </div>
          <div className="globe-stage">
            <MoonGlobe
              target={target}
              sites={candidateSites}
              missionData={missions}
              sun={sun}
              earth={earth}
              landingRun={landingRun}
              isAutoRotate={isAutoRotate}
              onResetRef={resetViewRef}
            />
            <div className="globe-corner-label corner-tl"><span>ACTIVE TARGET</span><strong>{target.name}</strong></div>
            <div className="globe-corner-label corner-tr"><span>LAT / EAST LON</span><strong>{formatCoordinate(target.lat, true)}<br />{formatCoordinate(target.lon, false)}</strong></div>
            <div className="globe-controls">
              <button onClick={() => setIsAutoRotate((value) => !value)} aria-pressed={isAutoRotate}>{isAutoRotate ? 'Ⅱ' : '▶'} <span>{isAutoRotate ? 'PAUSE ROTATION' : 'AUTO ROTATE'}</span></button>
              <button onClick={() => { setIsAutoRotate(true); resetViewRef.current?.() }}>⌖ <span>RESET VIEW</span></button>
            </div>
            <div className="globe-caption"><span className="pin-key" /> SELECTED COORDINATE <span className="archive-key" /> MISSION RECORD</div>
          </div>
          <div className="globe-bottomline">
            <div className="globe-coordinate-line"><span>ACTIVE SITE</span><strong>{target.name}</strong><i /> <span>{formatCoordinate(target.lat, true)} &nbsp; / &nbsp; {formatCoordinate(target.lon, false)}</span></div>
            <button className="descent-button" onClick={runDescent}><span>↓</span> ANIMATE DESCENT</button>
          </div>
          <div className="trajectory-note">
            <span className={landingStatus ? 'route-state active' : 'route-state'} />
            {landingStatus || 'Descent route is illustrative; it is not reconstructed flight telemetry.'}
          </div>
        </div>

        <aside className="control-panel">
          <section className="control-section target-section">
            <div className="panel-kicker"><span>01</span> TARGET COORDINATES</div>
            <label className="field-label" htmlFor="target-select">MISSION / LANDING ZONE</label>
            <select id="target-select" value={selectedSiteValue} onChange={(event) => chooseTarget(event.target.value)}>
              <option value="" disabled>Choose target</option>
              <optgroup label="NASA Moon Trek · CLPS sites">
                {candidateSites.map((site) => <option key={site.id} value={site.id}>{site.name} — {site.lander}</option>)}
              </optgroup>
              <optgroup label="LLSN mission records · mapped coordinates">
                {sitesAndMissions.filter((item) => item.id.startsWith('mission-')).map((mission) => <option key={mission.id} value={mission.id}>{mission.name} — {mission.year}</option>)}
              </optgroup>
            </select>
            <form className="coordinate-form" onSubmit={applyCustomCoordinates}>
              <label><span>LATITUDE</span><input aria-label="Latitude degrees" inputMode="decimal" value={latitudeInput} onChange={(event) => setLatitudeInput(event.target.value)} /><small>°</small></label>
              <label><span>EAST LONGITUDE</span><input aria-label="East longitude degrees" inputMode="decimal" value={longitudeInput} onChange={(event) => setLongitudeInput(event.target.value)} /><small>°</small></label>
              <button type="submit" className="apply-coordinates">APPLY</button>
            </form>
            {customError && <p className="inline-error" role="alert">{customError}</p>}
            <div className="target-meta"><span>COORDINATE DATUM</span><strong>Moon 2000 · east-positive longitude</strong></div>
            {target.payload && <div className="target-meta"><span>MISSION / PAYLOAD CONTEXT</span><a href={target.url || 'https://trek.nasa.gov/moon/'} target="_blank" rel="noreferrer">{target.payload} ↗</a></div>}
          </section>

          <section className="conditions-section">
            <div className="section-title"><span className="panel-kicker"><span>02</span> LIVE SITE CONDITIONS</span><span className={`source-pill ${ephemerisStatus}`}>{ephemerisStatus === 'live' ? 'JPL / DE441' : ephemerisStatus.toUpperCase()}</span></div>
            {ephemerisStatus === 'error' && (
              <div className="data-error" role="alert">
                <strong>Ephemeris unavailable</strong>
                <span>{ephemerisError}</span>
                <button onClick={() => setRefreshId((id) => id + 1)}>RETRY LIVE QUERY</button>
              </div>
            )}
            {ephemerisStatus === 'loading' && <div className="loading-line"><i /> Requesting a 30-day hourly observer table…</div>}
            <div className="body-condition sun-data">
              <span className="body-glyph sun-glyph">☼</span>
              <div className="body-data"><span>SUN · GEOMETRIC DISK VISIBILITY</span><strong>{sun ? `${Math.round(daylightFraction * 100)}%` : '—'}</strong></div>
              <div className="angle-data"><strong>{sun ? `${sun.elevation >= 0 ? '+' : ''}${sun.elevation.toFixed(2)}°` : '—'}</strong><small>{sun ? `${sun.azimuth.toFixed(2)}° AZ` : 'AZ / EL'}</small></div>
            </div>
            <div className="visibility-meter"><span style={{ width: `${daylightFraction * 100}%` }} /></div>
            <div className="body-condition earth-data">
              <span className="body-glyph earth-glyph">⊕</span>
              <div className="body-data"><span>EARTH · GEOMETRIC LINE OF SIGHT</span><strong>{earth ? (earth.elevation > 0 ? 'Above horizon' : 'Below horizon') : '—'}</strong></div>
              <div className="angle-data"><strong>{earth ? `${earth.elevation >= 0 ? '+' : ''}${earth.elevation.toFixed(2)}°` : '—'}</strong><small>{earth ? `${earth.azimuth.toFixed(2)}° AZ` : 'AZ / EL'}</small></div>
            </div>
            <div className="terrain-warning"><b>!</b><span>Geometric horizon only. Local terrain-horizon clearance is not inferred from elevation alone.</span></div>
          </section>

          <section className="site-data-section">
            <div className="panel-kicker"><span>03</span> LOLA & RESOURCE CONTEXT</div>
            <div className="site-data-row">
              <span className="data-icon">⌁</span>
              <div><small>SURFACE ELEVATION · NASA LOLA</small><strong>{elevationStatus === 'live' ? `${elevation.meters.toLocaleString(undefined, { maximumFractionDigits: 1 })} m` : elevationStatus === 'loading' ? 'Sampling DEM…' : 'Unavailable'}</strong></div>
              <span className={`tiny-status ${elevationStatus}`} />
            </div>
            {elevationStatus === 'error' && <p className="small-error">{elevationError}</p>}
            <div className="site-data-row resource-row">
              <span className="data-icon resource-icon">◇</span>
              <div><small>RESOURCE SCIENCE CONTEXT</small><strong>{resourceText}</strong></div>
            </div>
            <p className="resource-caveat">Regional prospecting context only. No water-ice abundance raster is loaded or claimed.</p>
          </section>

          <section className="mission-focus">
            <div className="panel-kicker"><span>04</span> LLSN MISSION ARCHIVE</div>
            <div className="mission-select-row">
              <label className="visually-hidden" htmlFor="mission-select">Select mission from supplied LLSN brief</label>
              <select id="mission-select" value={missionId} onChange={(event) => {
                const mission = missions.find((item) => item.id === event.target.value)
                if (mission) chooseMission(mission)
              }}>
                <option value="">Select a mission from the supplied brief</option>
                {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.year} · {mission.name}</option>)}
              </select>
              <span className="archive-count">26</span>
            </div>
            {selectedMission && (
              <div className="mission-detail">
                {selectedMission.image && missionImages[selectedMission.image] && <img src={missionImages[selectedMission.image]} alt={`${selectedMission.name} lunar surface photograph`} />}
                <div><strong>{selectedMission.name}</strong><span>{selectedMission.year} · {selectedMission.agency}</span><small>{selectedMission.type}</small></div>
                {Number.isFinite(selectedMission.lat) && <button onClick={() => chooseMission(selectedMission)}>FOCUS ↗</button>}
              </div>
            )}
            {missionNotice && <p className="mission-notice">{missionNotice}</p>}
          </section>
        </aside>
      </section>

      <section className="timeline-panel">
        <div className="timeline-header">
          <div><div className="panel-kicker"><span>05</span> LIVE EPHEMERIS TIMELINE</div><p>JPL observer solutions · hourly samples · 30-day window</p></div>
          <div className="epoch-picker">
            <label htmlFor="epoch-input">START EPOCH / UTC</label>
            <input id="epoch-input" type="datetime-local" value={startTime} onChange={(event) => { setStartTime(event.target.value); setHour(0) }} />
            <button onClick={() => setRefreshId((id) => id + 1)} disabled={ephemerisStatus === 'loading'}>REFRESH</button>
          </div>
        </div>
        <div className="ephemeris-legend"><span><i className="legend-sun" /> SUN ELEVATION</span><span><i className="legend-earth" /> EARTH ELEVATION</span><span><i className="legend-zero" /> GEOMETRIC HORIZON</span><span className="chart-date">{formatUtc(selectedDate)}</span></div>
        <div className="timeline-chart-wrap">
          {ephemerisStatus === 'live'
            ? <ElevationChart sunRows={ephemeris.sun} earthRows={ephemeris.earth} hour={hour} />
            : <div className="chart-placeholder">{ephemerisStatus === 'loading' ? 'Awaiting JPL Horizons hourly samples…' : 'Live chart unavailable. Retry the JPL query above.'}</div>}
        </div>
        <div className="timeline-controls">
          <button className="transport" aria-label="Start timeline" onClick={() => setHour(0)}>↤</button>
          <button className="transport" aria-label="Previous hour" onClick={() => setHour((value) => Math.max(0, value - 1))}>‹</button>
          <button className="play-control" aria-label={playing ? 'Pause timeline' : 'Play timeline'} disabled={ephemerisStatus !== 'live'} onClick={() => setPlaying((value) => !value)}>{playing ? 'Ⅱ' : '▶'}</button>
          <button className="transport" aria-label="Next hour" onClick={() => setHour((value) => Math.min(PLANNING_HOURS, value + 1))}>›</button>
          <button className="transport" aria-label="End timeline" onClick={() => setHour(PLANNING_HOURS)}>↦</button>
          <input
            aria-label="Ephemeris hour in 30-day window"
            className="time-range"
            type="range"
            min="0"
            max={PLANNING_HOURS}
            step="1"
            value={hour}
            disabled={ephemerisStatus !== 'live'}
            onChange={(event) => setHour(Number(event.target.value))}
          />
          <span className="hour-readout">{String(hour).padStart(3, '0')}<small> / 720 h</small></span>
        </div>
        <div className="timeline-range-labels"><span>{formatUtc(parseUtcInput(startTime))}</span><span>{formatUtc(new Date(parseUtcInput(startTime).getTime() + 10 * 24 * 3600000))}</span><span>{formatUtc(new Date(parseUtcInput(startTime).getTime() + 20 * 24 * 3600000))}</span><span>+30 DAYS</span></div>
      </section>

      <details className="archive-panel">
        <summary><span><i>06</i> MISSION ARCHIVE FROM LLSN BRIEF</span><strong>26 records <b>⌄</b></strong></summary>
        <div className="archive-toolbar">
          <p>Names, years, agencies, and types are transcribed from <em>LLSN - SKY_X (2).pdf</em>. Coordinates are included only when matched to a NASA Moon Trek landing, impact, rover, or CLPS record.</p>
          <label><span className="visually-hidden">Filter missions</span><input value={missionSearch} onChange={(event) => setMissionSearch(event.target.value)} placeholder="Filter mission, agency, year…" /></label>
        </div>
        <div className="archive-grid">
          {filteredMissions.map((mission) => (
            <button key={mission.id} className={missionId === mission.id ? 'archive-card chosen' : 'archive-card'} onClick={() => chooseMission(mission)}>
              <span className="archive-year">{mission.year}</span><strong>{mission.name}</strong><small>{mission.agency}</small>
              <i>{mission.type}</i>
              {Number.isFinite(mission.lat) ? <span className="archive-coordinate">{formatCoordinate(mission.lat, true)} · {formatCoordinate(mission.lon, false)}</span> : <span className="archive-coordinate muted">No mapped surface coordinate</span>}
            </button>
          ))}
        </div>
      </details>

      <footer className="footer">
        <div className="footer-title"><span className="footer-sigil">S</span><span>SELENE<small>LUNAR SITE INTELLIGENCE</small></span></div>
        <div className="footer-sources">LRO WAC · LOLA DEM · JPL HORIZONS DE441 · LLSN MISSION BRIEF</div>
        <span className="footer-caveat">PLANNING PREVIEW · NOT FOR FLIGHT</span>
      </footer>
    </main>
  )
}

export default App
