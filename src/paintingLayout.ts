import { MOON_GATE } from './moonGateLayout.ts'

// Shared by the scenery, Rapier and camera paths. Coordinates stay world-local across the gate.
export const CLOUD_TERRACE = {
  x: -1.5, y: 4.8, z: -34.5, width: 11, length: 18,
  tee: { x: -.85, y: 6.11, z: -31.2 },
  aim: { x: -1.5, z: -39 },
  rallyMidZ: -35.2,
  returnZ: -32.4,
  seals: {
    left: { x: -4.2, z: -39.4 },
    right: { x: 1.2, z: -39.4 },
  },
  sealRadius: .89,
  sealHeight: .22,
  camera: { position: [-1.5, 10.67, -22.8], target: [-1.5, 6.95, -36.8] },
} as const
export type MountainSeal = keyof typeof CLOUD_TERRACE.seals

export type Entry = 'painting' | 'entering' | 'playing'
export const PAINTING = {
  z: 31, y: 13.5, height: 28 * 543 / 1033, width: 28,
  ballU: (350 - 20) / 1033, ballV: 1 - (584 - 87) / 543,
  eye: [0, 13.5, 51] as const,
  duration: 4.2,
}

export const RIDGE_WALK = {
  x: -1.5, y: 4.8, z: -43.45, width: 5.4, length: Math.hypot(11.15, 7.2), angle: Math.atan2(7.2, 11.15),
} as const
export const SUMMIT = {
  x: -1.5, y: 12, z: -60.6, width: 13.8, length: 12,
  tee: { x: -.85, y: 13.31, z: -56.6 },
  eye: [-3.40, 16.42, -47.90] as const,
  look: [-2.55, 14.17, -64.90] as const,
  fov: 42,
  aperture: MOON_GATE,
  defaultAim: { x: -.85, y: 14.22 },
  flightTime: .96,
  moon: { x: 5, y: 29.22, z: -74.5, radius: 1.7 },
  vistaEye: [94, 69, -16] as const,
  vistaLook: [0, 4, -24] as const,
} as const

export const scrollSurfaceY = -3.48

// Door-to-terrace slope: visual surface, collision and traversal camera share these endpoints.
export const GATE_WALK = {
  x: -1.5, startZ: -18.35, endZ: -25.5, startY: .78, endY: 4.8, width: 3.2,
  length: Math.hypot(7.15,4.02), angle: Math.atan2(4.02,7.15),
} as const
