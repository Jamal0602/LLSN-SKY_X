import apollo11Image from '../../data/source-image/apollo11-lunar-surface.jpg'
import apollo17Image from '../../data/source-image/apollo17-lunar-panorama.jpg'

export const candidateSites = [
  {
    id: 'sinus-viscositatis',
    name: 'Sinus Viscositatis',
    lat: 35.26,
    lon: -40.99,
    lander: 'Peregrine',
    payload: 'Astrobotic Peregrine Mission-1 NASA-provided payloads',
    url: 'https://science.nasa.gov/lunar-discovery/deliveries/to2-astrobotic',
  },
  {
    id: 'nobile-region',
    name: 'Nobile Region',
    lat: -85.28,
    lon: 53.27,
    lander: 'Griffin',
    payload: 'Astrobotic Griffin Mission-1 NASA-provided payloads',
    url: 'https://science.nasa.gov/moon/',
  },
  {
    id: 'malapert-a',
    name: 'Malapert A',
    lat: -80.13,
    lon: 1.44,
    lander: 'Nova-C',
    payload: 'CLPS IM-1 NASA-provided payloads',
    url: 'https://science.nasa.gov/lunar-discovery/',
  },
  {
    id: 'shackleton-connecting-ridge',
    name: 'Shackleton Connecting Ridge',
    lat: -89.63,
    lon: 132.32,
    lander: 'Nova-C',
    payload: 'CLPS IM-2 NASA-provided payload',
    url: 'https://science.nasa.gov/moon/',
  },
  {
    id: 'reiner-gamma',
    name: 'Reiner Gamma',
    lat: 7.39,
    lon: -58.96,
    lander: 'Nova-C',
    payload: 'CLPS IM-3 NASA-provided payloads',
    url: 'https://science.nasa.gov/moon/',
  },
  {
    id: 'mare-crisium',
    name: 'Mare Crisium',
    lat: 16.18,
    lon: 59.1,
    lander: 'Blue Ghost',
    payload: 'Firefly Blue Ghost Mission 1 NASA-provided payloads',
    url: 'https://science.nasa.gov/moon/',
  },
  {
    id: 'schrodinger-basin',
    name: 'Schrödinger Basin',
    lat: -74.73,
    lon: 132.93,
    lander: 'SERIES-2',
    payload: 'Team Draper CLPS NASA-provided payloads',
    url: 'https://science.nasa.gov/moon/',
  },
]

export const missionImages = {
  apollo11: apollo11Image,
  apollo17: apollo17Image,
}

export const missions = [
  { id: 'luna-3', name: 'Luna 3', year: 1959, agency: 'Soviet Union', type: 'Flyby' },
  { id: 'luna-9', name: 'Luna 9', year: 1966, agency: 'Soviet Union', type: 'Lander', lat: 7.13, lon: -64.37, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'luna-10', name: 'Luna 10', year: 1966, agency: 'Soviet Union', type: 'Orbiter' },
  { id: 'surveyor-1', name: 'Surveyor 1', year: 1966, agency: 'NASA (USA)', type: 'Lander', lat: -2.4745, lon: -43.3398, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'lunar-orbiter-1', name: 'Lunar Orbiter 1', year: 1966, agency: 'NASA (USA)', type: 'Orbiter' },
  { id: 'apollo-8', name: 'Apollo 8', year: 1968, agency: 'NASA (USA)', type: 'Crewed orbit' },
  { id: 'apollo-11', name: 'Apollo 11', year: 1969, agency: 'NASA (USA)', type: 'Human landing', lat: 0.67416, lon: 23.47314, coordinateSource: 'NASA Moon Trek historic landing layer', image: 'apollo11' },
  { id: 'luna-16', name: 'Luna 16', year: 1970, agency: 'Soviet Union', type: 'Sample return', lat: -0.5137, lon: 56.3638, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'luna-17', name: 'Luna 17 / Lunokhod 1', year: 1970, agency: 'Soviet Union', type: 'Lander + rover', lat: 38.23764, lon: -35.00163, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'apollo-15', name: 'Apollo 15', year: 1971, agency: 'NASA (USA)', type: 'Human landing + rover', lat: 26.13239, lon: 3.6333, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'apollo-17', name: 'Apollo 17', year: 1972, agency: 'NASA (USA)', type: 'Human landing + rover', lat: 20.1911, lon: 30.7723, coordinateSource: 'NASA Moon Trek historic landing layer', image: 'apollo17' },
  { id: 'luna-21', name: 'Luna 21 / Lunokhod 2', year: 1973, agency: 'Soviet Union', type: 'Lander + rover', lat: 25.9994, lon: 30.4076, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'clementine', name: 'Clementine', year: 1994, agency: 'NASA / DoD (USA)', type: 'Orbiter' },
  { id: 'smart-1', name: 'SMART-1', year: 2003, agency: 'ESA (Europe)', type: 'Orbiter', lat: -34.4, lon: -46.2, coordinateSource: 'NASA Moon Trek impact layer', event: 'Impact' },
  { id: 'kaguya', name: 'Kaguya (SELENE)', year: 2007, agency: 'JAXA (Japan)', type: 'Orbiter', lat: -65.5, lon: 80.4, coordinateSource: 'NASA Moon Trek impact layer', event: 'Impact' },
  { id: 'chandrayaan-1', name: 'Chandrayaan-1', year: 2008, agency: 'ISRO (India)', type: 'Orbiter + impactor' },
  { id: 'lro', name: 'Lunar Reconnaissance Orbiter', year: 2009, agency: 'NASA (USA)', type: 'Orbiter' },
  { id: 'change-3', name: "Chang'e 3 & Yutu", year: 2013, agency: 'CNSA (China)', type: 'Lander + rover', lat: 44.1214, lon: -19.5117, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'queqiao', name: 'Queqiao', year: 2018, agency: 'CNSA (China)', type: 'Relay satellite (L2)' },
  { id: 'change-4', name: "Chang'e 4 & Yutu-2", year: 2019, agency: 'CNSA (China)', type: 'Lander + rover', lat: -45.457, lon: 177.589, coordinateSource: 'NASA Moon Trek historic landing layer' },
  { id: 'artemis-1', name: 'Artemis I', year: 2022, agency: 'NASA (USA)', type: 'Uncrewed orbit' },
  { id: 'danuri', name: 'Danuri (KPLO)', year: 2022, agency: 'KARI (South Korea)', type: 'Orbiter' },
  { id: 'chandrayaan-3', name: 'Chandrayaan-3 (Vikram & Pragyan)', year: 2023, agency: 'ISRO (India)', type: 'Lander + rover' },
  { id: 'slim', name: 'SLIM', year: 2024, agency: 'JAXA (Japan)', type: 'Lander' },
  { id: 'odysseus', name: 'Odysseus (IM-1)', year: 2024, agency: 'Intuitive Machines / NASA', type: 'Lander', lat: -80.13, lon: 1.44, coordinateSource: 'NASA Moon Trek CLPS site layer' },
  { id: 'change-6', name: "Chang'e 6", year: 2024, agency: 'CNSA (China)', type: 'Sample return' },
]

export const imageCredits = [
  {
    file: 'nasa-lro-wac-global.png',
    source: 'NASA Moon Trek / LRO Wide Angle Camera global mosaic, LRO_WAC_Mosaic_Global_303ppd_v02',
    url: 'https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_WAC_Mosaic_Global_303ppd_v02/ImageServer',
  },
  {
    file: 'apollo11-lunar-surface.jpg',
    source: 'NASA Image and Video Library, AS11-37-5545, Apollo 11 flag on the lunar surface',
    url: 'https://images.nasa.gov/details/as11-37-5545',
  },
  {
    file: 'apollo17-lunar-panorama.jpg',
    source: 'NASA Image and Video Library, JSC2004E52775, Apollo 17 lunar surface panorama',
    url: 'https://images.nasa.gov/details/jsc2004e52775',
  },
]
