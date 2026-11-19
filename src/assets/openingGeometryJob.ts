import type { OpeningShape } from './openingShapes'
import type { PackedGeometry } from './openingGeometryData'

export const prepared = new Map<OpeningShape, PackedGeometry>()
let pending: Promise<void> | undefined

export function prepareOpeningGeometry() {
  pending ??= new Promise<void>(resolve => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./openingGeometry.worker.ts',import.meta.url),{type:'module'})
    } catch { resolve(); return }
    const finish = () => { clearTimeout(timer); worker.terminate(); resolve() }
    const timer = window.setTimeout(finish, 8000)
    worker.onerror = finish
    worker.onmessageerror = finish
    worker.onmessage = ({data}) => {
      if (data.done) finish()
      else prepared.set(data.name,data.data)
    }
    worker.postMessage('prepare')
  })
  return pending
}

