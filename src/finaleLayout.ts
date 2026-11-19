import { Matrix4 } from 'three'

export const FOLIO = {
  moonHold: 3.08,
  survey: 6.24,
  upright: 8.86,
  inkStart: 10.42,
  inkEnd: 14.05,
  settled: 14.27,
  centerZ: -15.5,
  height: 148,
  portraitEye: [7, 191, -15.5] as const,
  portraitTarget: [7, -3.48, -15.5] as const,
  portraitFov: 46,
  portraitOffset: -6.2,
} as const

// Material pigments are authored in map coordinates. This uniform removes
// the presentation rotation from their world-space lookup during the finale.
export const folioWorldToMap = { value: new Matrix4() }
