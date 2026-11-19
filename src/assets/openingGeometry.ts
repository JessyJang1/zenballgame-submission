import { openingShapes, type OpeningShape } from './openingShapes'
import { unpackGeometry } from './openingGeometryData'
import { prepared } from './openingGeometryJob'

// Each mount owns its GPU geometry. A renderer that cannot start the worker
// uses the identical authoring functions on the main thread.
export function openingGeometry(name: OpeningShape) {
  const data = prepared.get(name)
  return data ? unpackGeometry(data) : openingShapes[name]()
}
