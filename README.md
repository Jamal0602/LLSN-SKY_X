# LLSN-SKY_X — Lunar Landing Site Navigator

LLSN-SKY_X is a browser-based lunar site exploration prototype based on the supplied NASA Space Apps Challenge brief. It combines an interactive Moon, an LRO WAC 2D coordinate map, documented landing and CLPS targets, custom coordinates, JPL Sun/Earth observer geometry, LOLA elevation samples, a 30-day timeline, the 26 mission records in the supplied archive, a live list of upcoming lunar launches, and a downloadable site-condition summary.

## Run locally

```sh
npm install
npm run dev
```

Keep network access available for the live data panels. The Vite development server proxies JPL Horizons, NASA Moon Trek, and Launch Library 2 requests. Vercel deployments use the same-origin handlers in `api/`; other static hosts must provide equivalent API routes because Vite development proxies are not included in the static build. Launch Library may rate-limit requests; retry after the provider's limit clears.

## Sources and limits

- Sun/Earth azimuth and elevation: JPL Horizons observer ephemerides for the selected lunar coordinates.
- Elevation: NASA Moon Trek / LRO LOLA DEM point sample.
- Lunar globe: NASA Moon Trek / LRO WAC mosaic.
- Historical mission archive: 26 records transcribed from the supplied LLSN brief. Mission coordinates are shown only when matched to a cited NASA Moon Trek record.
- Upcoming launch schedule: Launch Library 2. Dates are provider-reported NET estimates and may change; precision and status are displayed.
- Mission route animations and descent paths are schematic, not reconstructed telemetry.
- Geometric visibility is not terrain-corrected clearance. Regional volatile context is not a measured resource-abundance map. LLSN-SKY_X is not for flight or mission-critical decisions.
- The site summary reports the selected coordinate and hour only; it is a planning aid, not a mission certification.

`data/media-catalog.csv` lists remote NASA media search endpoints and selected source references. It does not download or bundle the linked media. Confirm item-level credits and usage terms before reuse.
