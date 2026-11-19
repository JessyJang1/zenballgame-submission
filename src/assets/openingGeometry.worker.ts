import { openingShapes, type OpeningShape } from './openingShapes'
import { packGeometry } from './openingGeometryData'

self.onmessage = () => {
  const shapes = Object.keys(openingShapes) as OpeningShape[]
  for (const name of shapes) {
    const data = packGeometry(openingShapes[name]())
    const buffers = data.attributes.map(attribute => attribute.array.buffer as ArrayBuffer)
    if (data.index) buffers.push(data.index.buffer as ArrayBuffer)
    self.postMessage({ name, data }, { transfer: buffers })
  }
  self.postMessage({ done: true })
}
