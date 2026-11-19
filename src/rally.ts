import RAPIER from '@dimforge/rapier3d-compat'
import { worldTerrain } from './terrainSurface.ts'
import { CLOUD_TERRACE, RIDGE_WALK, SUMMIT, GATE_WALK, type MountainSeal } from './paintingLayout.ts'
import { MOON_GATE_FOOTINGS, moonGateColliderMesh } from './moonGateLayout.ts'
import { summitSurfaceMesh } from './summitTerraceLayout.ts'
import { stoneBellCollision } from './assets/stoneBellCollision.ts'
import { lotusPetalCollision } from './assets/lotusPetalCollision.ts'
import { mountainSealCollision } from './assets/mountainSealCollision.ts'
import { GATE, LOTUS, LOTUS_BUD_SCALE, LOTUS_HEART, LOTUS_PETALS, STONE_BELL, BELL_MOUNT, inLotusWater } from './gardenLayout.ts'

export const COURT = {
  halfWidth: 4.15,
  halfLength: 11.86,
  serviceLine: 6.39,
  netHalfWidth: 5.06,
  netHeight: 1.08,
  netDepth: 0.09,
  aimDepth: -5.4,
  aimLimit: 5.65,
}
export const BALL_RADIUS = 0.17
export const STEP = 1 / 120
const skySensorHalfDepth = .055
// The first overlap with the sensor occurs only after the ball clears the rear face.
const skyExitZ = SUMMIT.aperture.z - SUMMIT.aperture.depth / 2 - 2 * BALL_RADIUS - skySensorHalfDepth - .025
const GRAVITY = 9.81
const REBOUND = 0.79
const OPEN = 0.09
const CLOSE = 0.65
const PERFECT = 0.32
const GOOD_MARGIN = 0.23
const INPUT_BUFFER = 0.17
const SHADOW_DELAY = 0.29
const SERVE = { x: 0.62, y: 1.31, z: 7.35 }

const SHADOW_SHOTS = [
  { x: 0.15, z: 4.6, time: 1.65 },
  { x: -1.2, z: 4.8, time: 1.58 },
  { x: 1.35, z: 4.65, time: 1.68 },
  { x: -0.65, z: 5.15, time: 1.6 },
  { x: 0.92, z: 4.55, time: 1.55 },
]

type Vec = { x: number; y: number; z: number }
type Phase = 'ready' | 'outbound' | 'incoming' | 'window' | 'ended'
type Fault = 'net' | 'out' | 'miss' | 'gate' | 'frame' | 'sky-rim' | 'sky-miss' | 'water'
export type Quality = 'clean' | 'good' | 'soft'
export type Cue = 'serve' | 'hit' | 'shadow' | 'bounce' | 'target' | 'swish' | 'fault' | 'lotus' | 'bell' | 'perfect' | 'barrier' | 'passage' | 'seal' | 'mountain' | 'moonGate' | 'water' | 'contact'
export type Ritual = 'lotus' | 'bell' | 'passage' | 'cleared' | 'mountain' | 'unfolding' | 'summit' | 'moonrise' | 'ending'
export type Impact = 'bounce' | 'lotus' | 'bell' | 'barrier' | 'perfect' | 'mountain' | 'water'
type LotusContact = 'petal' | 'heart' | null
export type RallyStatus = Readonly<{
  phase: Phase
  returns: number
  fault: Fault | null
  quality: Quality | null
  early: boolean
  ritual?: Ritual
  mountainSeal?: MountainSeal
  mountainHits?: number
  mountainWindow?: 'live' | 'late'
  sealContact?: 'soft' | 'wrong'
}>

const initialStatus: RallyStatus = {
  phase: 'ready', returns: 0, fault: null, quality: null, early: false,
}

let initialization: Promise<void> | undefined
export function initPhysics() {
  initialization ??= RAPIER.init()
  return initialization
}

export function isOut(x: number, z: number, side: -1 | 1) {
  // A ball touching a boundary line is in.
  return Math.abs(x) > COURT.halfWidth + BALL_RADIUS ||
    Math.abs(z) > COURT.halfLength + BALL_RADIUS || z * side <= 0
}

export class Rally {
  private world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
  private events = new RAPIER.EventQueue(true)
  private ball = this.world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setCanSleep(false),
  )
  private ground = this.world.createCollider(
    RAPIER.ColliderDesc.cuboid(24, 0.3, 28).setTranslation(0, -0.3, 0),
  )
  private net = this.world.createCollider(
    RAPIER.ColliderDesc.cuboid(COURT.netHalfWidth, COURT.netHeight / 2, COURT.netDepth / 2)
      .setTranslation(0, COURT.netHeight / 2, 0),
  )
  private lotus?: RAPIER.Collider
  private lotusPetals: RAPIER.Collider[] = []
  lotusContact: LotusContact = null
  private bell?: RAPIER.Collider
  private bellFrame: RAPIER.Collider[] = []
  private scenicTerrain?: RAPIER.Collider
  private gate?: RAPIER.Collider
  private passage?: RAPIER.Collider
  private terrace?: RAPIER.Collider
  private foldStones?: Record<MountainSeal, RAPIER.Collider>
  private mountainColliders: RAPIER.Collider[] = []
  private skyRim: RAPIER.Collider[] = []
  private moonReceiver?: RAPIER.Collider
  private moonOrigin: Vec | null = null
  private moonAt = 0
  private status = initialStatus
  private listeners = new Set<() => void>()
  private bounceAt: number | null = null
  private firstBounce: Vec | null = null
  private bufferedUntil = -Infinity
  private shadowShot = 0
  private outboundScored = false
  private launchedAt = 0
  private windowEnd = CLOSE
  time = 0
  aim = 0
  aimZ = COURT.aimDepth
  aimY = 0
  impactKind: Impact = 'bounce'
  flightId = 0
  lastSwing = -Infinity
  playerContact: Readonly<{ time: number; position: Vec }> | null = null
  shadowContact: Rally['playerContact'] = null
  lastShadowSwing = -Infinity
  lastImpact = -Infinity
  impact: Vec = { x: 0, y: 0, z: 0 }

  constructor(cue: (cue: Cue) => void = () => {}, mode: 'court' | 'garden' = 'court') {
    this.cue = cue
    this.world.timestep = STEP
    this.world.maxCcdSubsteps = 4
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setRestitution(REBOUND)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.ball,
    )
    this.ground.setFriction(0)
    this.net.setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
    if (mode === 'garden') {
      this.scenicTerrain=this.world.createCollider(RAPIER.ColliderDesc.trimesh(worldTerrain.positions,worldTerrain.indices).setFriction(0))
      this.windowEnd = .88
      this.lotus = this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(LOTUS_HEART.halfHeight, LOTUS_HEART.radius)
          .setTranslation(LOTUS.x, LOTUS_HEART.y, LOTUS.z).setFriction(0),
      )
      this.lotusPetals = LOTUS_PETALS.map(({ yaw, closedPitch, scale }) => {
        const cosPitch = Math.cos(closedPitch), sinPitch = Math.sin(closedPitch)
        const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw)
        const factor = LOTUS_BUD_SCALE * scale
        const points = lotusPetalCollision.vertices.flatMap(([x, y, z]) => {
          const depth = y * sinPitch + z * cosPitch
          return [
            factor * (x * cosYaw + depth * sinYaw),
            factor * (y * cosPitch - z * sinPitch),
            factor * (depth * cosYaw - x * sinYaw),
          ]
        })
        const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(points))
        if (!hull) throw new Error('Invalid lotus petal collision geometry')
        return this.world.createCollider(hull.setTranslation(LOTUS.x, LOTUS.height, LOTUS.z).setFriction(0))
      })
      const vertices = new Float32Array(stoneBellCollision.vertices.flat())
      const bell = RAPIER.ColliderDesc.convexHull(vertices)
      if (!bell) throw new Error('Invalid stone bell collision geometry')
      this.bell = this.world.createCollider(bell.setTranslation(STONE_BELL.x, BELL_MOUNT.bellHangY, STONE_BELL.z))
      for (const side of [-1,1]) this.bellFrame.push(this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(BELL_MOUNT.postHalfWidth,BELL_MOUNT.postHalfHeight,BELL_MOUNT.postHalfDepth)
          .setTranslation(STONE_BELL.x+side*BELL_MOUNT.postX,BELL_MOUNT.postY,STONE_BELL.z)))
      this.bellFrame.push(this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(BELL_MOUNT.beamHalfWidth,BELL_MOUNT.beamHalfHeight,BELL_MOUNT.beamHalfDepth)
          .setTranslation(STONE_BELL.x,BELL_MOUNT.beamY,STONE_BELL.z)))
      const openingY = GATE.y + GATE.openingHeight / 2
      this.gate = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(GATE.halfOpening, GATE.openingHeight / 2, .12)
          .setTranslation(GATE.x, openingY, GATE.z),
      )
      // Inset the sensor by the ball radius on both sides. A grazing ball cannot count as a pass.
      this.passage = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(GATE.halfOpening - 2 * BALL_RADIUS, GATE.openingHeight / 2 - 2 * BALL_RADIUS, .16)
          .setTranslation(GATE.x, openingY, GATE.z - .65).setSensor(true),
      )
      const { x, y, z, width, length, seals, sealHeight, sealRadius } = CLOUD_TERRACE
      this.terrace = this.world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, .39, length / 2)
        .setTranslation(x, y - .39, z).setFriction(0))
      const sealVertices = mountainSealCollision && new Float32Array(mountainSealCollision.vertices.flat())
      const sealCollider = ({ x, z }: { x: number; z: number }) => {
        if (!sealVertices) return this.world.createCollider(
          RAPIER.ColliderDesc.cylinder(sealHeight / 2, sealRadius).setTranslation(x, y + sealHeight / 2, z))
        const hull = RAPIER.ColliderDesc.convexHull(sealVertices)
        if (!hull) throw new Error('Invalid mountain seal collision geometry')
        return this.world.createCollider(hull.setTranslation(x, y, z))
      }
      this.foldStones = { left: sealCollider(seals.left), right: sealCollider(seals.right) }
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(3.35, .28, 1.275)
        .setTranslation(GATE.x, GATE.y - .29, GATE.z))
      for (const side of [-1, 1]) {
        this.world.createCollider(RAPIER.ColliderDesc.cuboid(.72, GATE.openingHeight / 2, .24)
          .setTranslation(GATE.x + side * (GATE.halfOpening + .72), openingY, GATE.z))
      }
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(2.6, .23, .28)
        .setTranslation(GATE.x, GATE.y + GATE.openingHeight + .23, GATE.z))
      const summitSurface = summitSurfaceMesh()
      this.mountainColliders.push(this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(summitSurface.vertices, summitSurface.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
          .setTranslation(SUMMIT.x, SUMMIT.y, SUMMIT.z).setFriction(0)))
      const bridge = RIDGE_WALK
      this.mountainColliders.push(this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(bridge.width / 2, .39, bridge.length / 2)
          .setTranslation(bridge.x, bridge.y - .39 * Math.cos(bridge.angle) + bridge.length / 2 * Math.sin(bridge.angle),
            bridge.z - .39 * Math.sin(bridge.angle) - bridge.length / 2 * Math.cos(bridge.angle))
          .setRotation({ x: Math.sin(bridge.angle / 2), y: 0, z: 0, w: Math.cos(bridge.angle / 2) }).setFriction(0)))
      const walk = GATE_WALK
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(walk.width / 2, .11, walk.length / 2)
        .setTranslation(walk.x, (walk.startY + walk.endY) / 2 - .11 * Math.cos(walk.angle),
          (walk.startZ + walk.endZ) / 2 - .11 * Math.sin(walk.angle))
        .setRotation({ x: Math.sin(walk.angle / 2), y: 0, z: 0, w: Math.cos(walk.angle / 2) }).setFriction(0))
      const aperture = SUMMIT.aperture
      this.moonReceiver = this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(skySensorHalfDepth, aperture.sensorRadius)
          .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
          .setTranslation(aperture.x, aperture.y, skyExitZ).setSensor(true))
      const rim = moonGateColliderMesh()
      this.skyRim.push(this.world.createCollider(
        RAPIER.ColliderDesc.trimesh(rim.vertices, rim.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
          .setTranslation(aperture.x, aperture.y, aperture.z)))
      for (const footing of MOON_GATE_FOOTINGS) this.skyRim.push(this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(footing.halfWidth, footing.halfHeight, footing.halfDepth)
          .setTranslation(aperture.x + footing.x, aperture.y + footing.y, aperture.z)))
      this.mountainColliders.push(...this.skyRim)
    }
    this.reset()
  }

  private cue: (cue: Cue) => void
  getStatus = () => this.status
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private update(values: Partial<RallyStatus>, base = this.status) {
    this.status = { ...base, ...values }
    this.listeners.forEach((listener) => listener())
  }

  dispose() {
    this.events.free()
    this.world.free()
  }

  reset() {
    this.shadowShot = 0
    this.restartAt(this.lotus ? 'lotus' : undefined, SERVE)
  }

  retry() {
    const { ritual } = this.status
    if (ritual === 'summit' || ritual === 'ending') {
      this.restartAt('summit', SUMMIT.tee)
    } else if (ritual === 'mountain') {
      this.restartAt('mountain', CLOUD_TERRACE.tee)
    } else if (ritual === 'bell') {
      this.restartAt('bell', SERVE)
    } else if (ritual === 'passage' || ritual === 'cleared') {
      this.restartAt('passage', GATE.tee)
    } else {
      this.reset()
    }
  }

  enterMountain() {
    if (this.status.ritual === 'cleared') this.restartAt('mountain', CLOUD_TERRACE.tee)
  }

  enterSummit() {
    if (this.status.ritual === 'unfolding') this.restartAt('summit', SUMMIT.tee)
  }

  finishPainting() {
    if (this.status.ritual === 'moonrise' && this.moonProgress() === 1) this.update({ ritual: 'ending' })
  }

  moonProgress() {
    return this.moonOrigin ? Math.min(1, (this.time - this.moonAt) / 2.55) : 0
  }

  private restartAt(ritual: Ritual | undefined, position: Vec, phase: Phase = 'ready', lotusContact: LotusContact = null) {
    this.time = 0
    this.aimY = SUMMIT.defaultAim.y
    this.moonOrigin = null
    this.aim = ritual === 'summit' ? SUMMIT.defaultAim.x : ritual === 'mountain' ? CLOUD_TERRACE.aim.x : ritual === 'passage' ? GATE.x : 0
    this.aimZ = ritual === 'summit' ? SUMMIT.aperture.z : ritual === 'mountain' ? CLOUD_TERRACE.aim.z : ritual === 'passage' ? GATE.targetZ : COURT.aimDepth
    this.lastSwing = this.lastShadowSwing = this.lastImpact = -Infinity
    this.playerContact = null
    this.shadowContact = null
    this.impactKind = 'bounce'
    this.impact = { x: 0, y: 0, z: 0 }
    this.outboundScored = false
    this.placeBall(position)
    this.events.clear()
    this.clearFlight()
    this.lotusContact = lotusContact
    this.lotus?.setEnabled(ritual === 'lotus')
    this.lotusPetals.forEach(petal => petal.setEnabled(ritual === 'lotus'))
    this.bell?.setEnabled(ritual === 'bell')
    this.bellFrame.forEach(collider=>collider.setEnabled(ritual!==undefined&&ritual!=='lotus'))
    this.gate?.setEnabled(ritual === 'lotus' || ritual === 'bell')
    this.passage?.setEnabled(ritual === 'passage')
    if (this.foldStones) {
      this.foldStones.left.setEnabled(ritual === 'mountain')
      this.foldStones.right.setEnabled(ritual === 'mountain')
    }
    this.moonReceiver?.setEnabled(ritual === 'summit')
    for (const collider of this.mountainColliders) collider.setEnabled(ritual === 'summit')
    this.update(ritual ? { ritual, phase } : {}, initialStatus)
  }

  private placeBall(position: Vec) {
    this.flightId += 1
    this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true)
    this.ball.setTranslation(position, true)
    this.ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  setAim(x: number, z = COURT.aimDepth, y = 0) {
    const { phase, ritual } = this.status
    if (phase === 'ended') return
    if (ritual === 'summit') {
      this.aim = Math.min(6.5, Math.max(-6.5, x))
      this.aimY = Math.min(SUMMIT.y + 6.92, Math.max(SUMMIT.y + .52, y))
      return
    }
    if (ritual === 'mountain') {
      const { x: center, width, z: depth, length, tee } = CLOUD_TERRACE
      this.aim = Math.min(center + width / 2, Math.max(center - width / 2, x))
      this.aimZ = Math.min(tee.z - 2, Math.max(depth - length / 2, z))
      return
    }
    if (ritual === 'passage') {
      this.aim = Math.min(GATE.x + 4, Math.max(GATE.x - 4, x))
      return
    }
    const limit = ritual ? 7.65 : COURT.aimLimit
    this.aim = Math.min(limit, Math.max(-limit, x))
    if (ritual) this.aimZ = Math.min(-1.8, Math.max(-11.5, z))
  }

  position() {
    return this.ball.translation()
  }

  velocity() {
    return this.ball.linvel()
  }

  landing(): Vec | null {
    if (this.status.phase === 'ready' || this.status.phase === 'ended') return null
    if (this.firstBounce) return this.firstBounce
    const p = this.position()
    const v = this.velocity()
    const groundY = this.status.ritual === 'mountain' ? CLOUD_TERRACE.y : 0
    const t = (v.y + Math.sqrt(v.y * v.y + 2 * GRAVITY * Math.max(0, p.y - groundY - BALL_RADIUS))) / GRAVITY
    return { x: p.x + v.x * t, y: groundY, z: p.z + v.z * t }
  }

  progression() {
    const age = this.bounceAt === null ? 0 : this.time - this.bounceAt
    return Math.max(0, Math.min(1, (age - OPEN) / (this.windowEnd - OPEN)))
  }

  skyShotPoint(fraction: number, from: Vec): Vec {
    return {
      x: from.x + (this.aim - from.x) * fraction,
      y: from.y + (this.aimY - from.y) * fraction +
        .5 * GRAVITY * SUMMIT.flightTime ** 2 * fraction * (1 - fraction),
      z: from.z + (SUMMIT.aperture.z - from.z) * fraction,
    }
  }

  skyAimCentered() {
    const aperture = SUMMIT.aperture
    const from = SUMMIT.tee
    const depth = from.z - aperture.z
    const offsetFromCenter = (z: number) => {
      const p = this.skyShotPoint((from.z - z) / depth, from)
      return Math.hypot(p.x - aperture.x, p.y - aperture.y)
    }
    const clearance = aperture.radius - BALL_RADIUS - .025
    return offsetFromCenter(aperture.z + aperture.boreHalfDepth) <= clearance &&
      offsetFromCenter(aperture.z - aperture.boreHalfDepth) <= clearance &&
      offsetFromCenter(skyExitZ + BALL_RADIUS + skySensorHalfDepth) <= aperture.sensorRadius
  }

  swing() {
    if (this.status.phase === 'ended') return
    // Keyboard auto-repeat is filtered by the UI. This also debounces quick taps.
    if (this.time - this.lastSwing < 0.11) return
    this.lastSwing = this.time
    if (this.status.phase === 'ready') {
      this.playerContact = { time: this.time, position: this.position() }
      if (this.status.ritual === 'passage') this.launch(this.aim, GATE.targetZ, .93)
      else if (this.status.ritual === 'summit') this.launch(this.aim, SUMMIT.aperture.z, SUMMIT.flightTime, this.aimY - BALL_RADIUS)
      else if (this.status.ritual === 'mountain') this.launch(this.aim, this.aimZ, 1.24, CLOUD_TERRACE.y)
      else this.launch(this.aim, this.aimZ, 1.49)
      this.update({ phase: 'outbound' })
      this.cue('serve')
      return
    }
    if (this.status.phase === 'window') {
      this.returnBall()
      return
    }
    if (this.status.phase === 'incoming') {
      this.bufferedUntil = this.time + INPUT_BUFFER
      if (!this.status.early) this.update({ early: true })
    }
    this.cue('swish')
  }

  step() {
    this.time += STEP
    const { phase, ritual, mountainSeal } = this.status
    if (ritual === 'moonrise' && this.moonOrigin) {
      const t = this.moonProgress()
      const from = this.moonOrigin
      const to = SUMMIT.moon
      this.ball.setTranslation({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * (1 - (1 - t) ** 2),
        z: from.z + (to.z - from.z) * t,
      }, true)
    }
    if (phase === 'ready' || phase === 'ended') return

    let touchedFrame = false
    let touchedTerrain = false
    let touchedNet = false
    let touchedGround = false
    let touchedLotus = false
    let touchedPetal = false
    let touchedBell = false
    let touchedGate = false
    let crossedPassage = false
    let touchedTerrace = false
    let touchedStone: MountainSeal | undefined
    let touchedMountain = false
    let touchedSkyRim = false
    let caughtBySky = false
    this.world.step(this.events)
    this.events.drainCollisionEvents((a, b, started) => {
      if (!started) return
      if (this.bellFrame.some(c=>a===c.handle||b===c.handle)) touchedFrame=true
      if (this.scenicTerrain && (a === this.scenicTerrain.handle || b === this.scenicTerrain.handle)) touchedTerrain = true
      if (a === this.net.handle || b === this.net.handle) touchedNet = true
      if (a === this.ground.handle || b === this.ground.handle) touchedGround = true
      if (this.lotus && (a === this.lotus.handle || b === this.lotus.handle)) touchedLotus = true
      if (ritual === 'lotus' && this.lotusPetals.some(({ handle }) => handle === a || handle === b)) touchedPetal = true
      if (this.bell && (a === this.bell.handle || b === this.bell.handle)) touchedBell = true
      if (this.gate && (a === this.gate.handle || b === this.gate.handle)) touchedGate = true
      if (this.terrace && (a === this.terrace.handle || b === this.terrace.handle)) touchedTerrace = true
      if (this.foldStones) {
        const { left, right } = this.foldStones
        if (a === left.handle || b === left.handle) touchedStone = 'left'
        if (a === right.handle || b === right.handle) touchedStone = 'right'
      }
      if (ritual === 'summit') {
        if (this.moonReceiver && (a === this.moonReceiver.handle || b === this.moonReceiver.handle)) caughtBySky = true
        if (this.mountainColliders.some(({ handle }) => a === handle || b === handle)) touchedMountain = true
        if (this.skyRim.some(({ handle }) => a === handle || b === handle)) touchedSkyRim = true
      }
      if (this.passage && (a === this.passage.handle || b === this.passage.handle)) crossedPassage = true
    })
    if (touchedFrame) { this.markImpact('barrier');this.cue('barrier');this.fail('frame');return }
    if (touchedTerrain) { this.markImpact('barrier'); this.cue('barrier'); this.fail(ritual === 'summit' ? 'sky-miss' : ritual === 'passage' ? 'gate' : 'out'); return }
    if (ritual === 'summit') {
      if (caughtBySky && !touchedMountain && this.velocity().z < 0) {
        this.moonOrigin = this.position()
        this.moonAt = this.time
        this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true)
        this.update({ phase: 'ended', ritual: 'moonrise' })
        this.cue('moonGate')
      } else if (touchedSkyRim) {
        this.markImpact('barrier')
        this.cue('barrier')
        this.fail('sky-rim')
      } else if (touchedMountain || touchedGround || this.time - this.launchedAt > 2.5) {
        this.fail('sky-miss')
      }
      return
    }
    if (ritual === 'mountain') {
      if (touchedStone && touchedStone === mountainSeal && phase === 'outbound' && this.status.quality !== 'soft' && this.outboundScored) {
        this.markImpact('mountain')
        if (!this.status.mountainHits) {
          this.shadowReturn()
          this.update({ mountainHits:1, mountainSeal: mountainSeal === 'left' ? 'right' : 'left' })
          this.cue('seal')
          return
        }
        this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true)
        this.update({ phase: 'ended', ritual: 'unfolding' })
        this.cue('mountain')
        return
      }
      if (touchedStone && mountainSeal && phase === 'outbound' && this.outboundScored) {
        const sealContact = touchedStone === mountainSeal ? 'soft' : 'wrong'
        if (this.status.sealContact !== sealContact) this.update({ sealContact })
      }
      if (touchedGround) {
        this.fail('out')
        return
      }
      if (touchedTerrace || touchedStone) this.land(phase, false, CLOUD_TERRACE.y)
      if (this.status.phase === 'ended') return
    }
    if (this.status.ritual === 'passage') {
      if (crossedPassage && this.velocity().z < 0) {
        this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true)
        this.update({ phase: 'ended', ritual: 'cleared' })
        this.cue('passage')
      } else if (touchedGround || touchedTerrace || this.time - this.launchedAt > 2) {
        this.fail('gate')
      }
      return
    }
    if (touchedNet || touchedGate) {
      this.markImpact('barrier')
      this.cue('barrier')
      this.fail(touchedGate ? 'gate' : 'net')
      return
    }
    if (touchedBell && phase === 'outbound' && this.status.ritual === 'bell') {
      this.markImpact('bell')
      this.bell?.setEnabled(false)
      this.gate?.setEnabled(false)
      this.passage?.setEnabled(true)
      this.placeBall(GATE.tee)
      this.clearFlight()
      this.aim = GATE.x
      this.aimZ = GATE.targetZ
      this.update({ phase: 'ready', ritual: 'passage', quality: null, early: false })
      this.cue('bell')
      return
    }
    if ((touchedPetal || touchedLotus) && phase === 'outbound' && ritual === 'lotus') {
      const contact = this.position()
      // Re-arm the next rally after the petal or heart reports real contact.
      this.restartAt('bell', SERVE, 'ready', touchedPetal ? 'petal' : 'heart')
      this.markImpact('lotus',contact)
      this.cue('lotus')
      return
    }
    if (touchedGround && (ritual === 'lotus' || ritual === 'bell') && inLotusWater(this.position().x,this.position().z)) {
      const contact = this.position()
      this.markImpact('water', { ...contact, y: -.053 })
      this.placeBall({ ...contact, y: -.19 })
      this.fail('water')
      return
    }
    if (touchedGround || touchedLotus || touchedPetal) this.land(phase, touchedLotus || touchedPetal)
    if (this.status.phase === 'ended') return

    if (this.bounceAt !== null) {
      const age = this.time - this.bounceAt
      if (phase === 'outbound' && age >= SHADOW_DELAY) this.shadowReturn()
      if (phase === 'incoming' && age >= OPEN) {
        this.update({ phase: 'window', early: false, ...(ritual === 'mountain' ? { mountainWindow: 'live' } : {}) })
        if (this.bufferedUntil >= this.time) this.returnBall()
        else if (this.status.ritual === 'mountain') this.cue('contact')
      }
      if (phase === 'window' && age >= this.windowEnd) this.fail('miss')
      else if (phase === 'window' && ritual === 'mountain' &&
        this.status.mountainWindow === 'live' && age - PERFECT > GOOD_MARGIN) this.update({ mountainWindow: 'late' })
    }

    if (this.status.early && this.bufferedUntil < this.time) this.update({ early: false })
    if (this.time - this.launchedAt > 4) this.fail('miss')
  }

  private clearFlight() {
    this.bounceAt = null
    this.firstBounce = null
    this.bufferedUntil = -Infinity
    this.launchedAt = this.time
  }

  private launch(x: number, z: number, duration: number, landingY = 0) {
    const p = this.position()
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
    this.ball.setLinvel({
      x: (x - p.x) / duration,
      y: (landingY + BALL_RADIUS - p.y) / duration + 0.5 * GRAVITY * (duration + STEP),
      z: (z - p.z) / duration,
    }, true)
    this.clearFlight()
  }

  private land(phase: Phase, lotus: boolean, groundY = 0) {
    if (this.bounceAt !== null) {
      this.fail('miss')
      return
    }
    const p = this.position()
    this.markImpact(lotus ? 'lotus' : 'bounce', p)
    this.bounceAt = this.time
    this.firstBounce = { x: p.x, y: lotus ? LOTUS.height : groundY, z: p.z }
    const localOut = Math.abs(p.x - CLOUD_TERRACE.x) > CLOUD_TERRACE.width / 2 + BALL_RADIUS ||
      Math.abs(p.z - CLOUD_TERRACE.z) > CLOUD_TERRACE.length / 2 + BALL_RADIUS ||
      (p.z - CLOUD_TERRACE.rallyMidZ) * (phase === 'outbound' ? -1 : 1) <= 0
    if (this.status.ritual === 'mountain' ? localOut : isOut(p.x, p.z, phase === 'outbound' ? -1 : 1)) {
      this.fail('out')
      return
    }
    if (phase === 'outbound' && this.outboundScored) {
      const returns = this.status.returns + 1
      this.update({ returns })
      this.cue(!this.status.ritual && returns === 3 ? 'target' : 'bounce')
    } else {
      this.cue('bounce')
    }
  }

  private shadowReturn() {
    const mountain = this.status.ritual === 'mountain'
    let mountainSeal = this.status.mountainSeal
    const awakenSeal = mountain && !mountainSeal
    if (awakenSeal) mountainSeal = (this.firstBounce?.x ?? CLOUD_TERRACE.x) <= CLOUD_TERRACE.x + .05 ? 'left' : 'right'
    const shot = mountain
      ? { x: CLOUD_TERRACE.x + [-.28, .23, -.08][this.shadowShot % 3], z: CLOUD_TERRACE.returnZ, time: 1.48 }
      : SHADOW_SHOTS[this.shadowShot % SHADOW_SHOTS.length]
    this.shadowShot += 1
    this.lastShadowSwing = this.time
    this.shadowContact = { time: this.time, position: this.position() }
    this.launch(shot.x, shot.z, shot.time, mountain ? CLOUD_TERRACE.y : 0)
    this.update({ phase: 'incoming', early: false, ...(awakenSeal ? { mountainSeal } : {}),
      ...(mountain ? { mountainWindow: undefined, sealContact: undefined } : {}) })
    this.cue('shadow')
    if (awakenSeal) this.cue('seal')
  }

  private returnBall() {
    const error = Math.abs(this.time - (this.bounceAt ?? this.time) - PERFECT)
    const quality = error <= 0.1 ? 'clean' : error <= GOOD_MARGIN ? 'good' : 'soft'
    this.lastSwing = this.time
    this.playerContact = { time: this.time, position: this.position() }
    const timingOffset = this.time - (this.bounceAt ?? this.time) - PERFECT
    // A late contact sends the ball slower and shorter. Debug mode keeps the V0.2 trajectory.
    const depth = this.status.ritual ? this.aimZ + Math.max(0, timingOffset - .10) * 1.8 : COURT.aimDepth
    this.launch(this.aim, depth, quality === 'clean' ? 1.29 : quality === 'good' ? 1.46 : 1.62, this.status.ritual === 'mountain' ? CLOUD_TERRACE.y : 0)
    if (quality === 'clean' && this.status.ritual) this.markImpact('perfect')
    this.outboundScored = true
    this.update({ phase: 'outbound', quality, early: false,
      ...(this.status.ritual === 'mountain' ? { mountainWindow: undefined, sealContact: undefined } : {}) })
    this.cue(quality === 'clean' && this.status.ritual ? 'perfect' : 'hit')
  }

  private markImpact(kind: Impact, position = this.position()) {
    this.impactKind = kind
    this.impact = position
    this.lastImpact = this.time
  }

  private fail(fault: Fault) {
    if (this.status.phase === 'ended') return
    this.ball.setBodyType(RAPIER.RigidBodyType.Fixed, true)
    this.update({ phase: 'ended', fault, early: false })
    this.cue(fault === 'water' ? 'water' : 'fault')
  }
}
