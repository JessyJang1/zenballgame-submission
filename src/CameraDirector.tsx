import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Color, Fog, MathUtils, PerspectiveCamera, Vector3, type Group } from 'three'
import { gardenCamera } from './assets/pigment'
import { GATE } from './gardenLayout'
import { CLOUD_TERRACE, SUMMIT, scrollSurfaceY, type Entry } from './paintingLayout'
import { STONE_PROLOGUE } from './stonePrologueLayout'
import type { Rally } from './rally'
import { FOLIO, folioWorldToMap } from './finaleLayout'

const gatePath = new CatmullRomCurve3([
  new Vector3(...gardenCamera.position),
  new Vector3(-.8, 7.1, 2),
  new Vector3(GATE.x, 3.4, -11.9),
  new Vector3(GATE.x, 2.02, -15.4),
  new Vector3(GATE.x, 2.02, -18.35),
  new Vector3(GATE.x, 4.35, -21.4),
  new Vector3(GATE.x, 7.1, -23.8),
  new Vector3(...CLOUD_TERRACE.camera.position),
])
const courtyardEye = new Vector3(...gardenCamera.position)
const courtyardTarget = new Vector3(...gardenCamera.target)
const cloudEye = new Vector3(...CLOUD_TERRACE.camera.position)
const cloudTarget = new Vector3(...CLOUD_TERRACE.camera.target)
const throughGate = new Vector3(GATE.x, 6.1, GATE.z - 15.1)

const stoneLook = new Vector3(...STONE_PROLOGUE.look)
const valleyLook = new Vector3(0, 3.2, 7)
const outsideSky = new Color('#a3b7b3')
const gardenSky = new Color('#244c40')
const caveAir = new Color('#9aab9e')
const inkSky = new Color('#192f2a')
const entryPath = new CatmullRomCurve3([
  new Vector3(...STONE_PROLOGUE.eye),
  new Vector3(-.35, 4.72, 47),
  new Vector3(.83, 4.31, 40),
  new Vector3(1.25, 4.58, 33),
  new Vector3(.12, 5.4, 26.9),
  courtyardEye,
])

const summitEye = new Vector3(...SUMMIT.eye)
const summitTarget = new Vector3(...SUMMIT.look)
const moonTarget = new Vector3(SUMMIT.moon.x, SUMMIT.moon.y, SUMMIT.moon.z)
const vistaEye = new Vector3(...SUMMIT.vistaEye)
const vistaTarget = new Vector3(...SUMMIT.vistaLook)
const unfoldPath = new CatmullRomCurve3([
  cloudEye,
  new Vector3(2.2, 9.4, -33),
  new Vector3(2.1, 10.0, -43.5),
  new Vector3(-1.5, 16.8, -48.5),
  summitEye,
])
const endingPath = new CatmullRomCurve3([
  summitEye,
  new Vector3(-.7, 20.9, -49.6),
  new Vector3(4.2, 25.2, -47.1),
  new Vector3(19, 37, -41),
  new Vector3(56, 59, -28),
  vistaEye,
])
const surveyEye = new Vector3(24, 150, 48)
const surveyLook = new Vector3(-1, 1.5, -13)
const surveyPath = new CatmullRomCurve3([
  endingPath.getPoint(MathUtils.smootherstep(FOLIO.moonHold, .30, 6.7)),
  new Vector3(33, 55, -25),
  new Vector3(38, 91, 13),
  surveyEye,
])
const portraitEye = new Vector3(...FOLIO.portraitEye)
const portraitTarget = new Vector3(...FOLIO.portraitTarget)
const folioPivot = new Vector3(0, scrollSurfaceY, FOLIO.centerZ)
const turnAxis = new Vector3(1, 0, 0)

export default function CameraDirector({ rally, entry, entryProgress, foldProgress, frameTime, folioTime, world, onEntry }: {
  rally: Rally; entry: Entry; entryProgress: RefObject<number>; foldProgress: RefObject<number>; frameTime: RefObject<number>; onEntry: () => void
  folioTime: RefObject<number>; world: RefObject<Group | null>
}) {
  const elapsed = useRef(0)
  const parallax=useRef({x:0,y:0})
  const previous = useRef('')
  const target = useRef(new Vector3())
  const risingBall = useRef(new Vector3())
  const lastAngle = useRef(0)

  useFrame(({ camera, scene, pointer, gl }) => {
    const { ritual } = rally.getStatus()
    const delta = frameTime.current
    if (previous.current !== ritual) {
      elapsed.current = 0
      previous.current = ritual ?? ''
    }
    const time = ritual === 'ending' ? FOLIO.settled : ritual === 'moonrise' ? elapsed.current + delta : 0
    folioTime.current = time
    const turn = MathUtils.smootherstep(time, FOLIO.survey, FOLIO.upright)
    const angle = turn * Math.PI / 2
    if (world.current && angle !== lastAngle.current) {
      world.current.rotation.x = angle
      world.current.position.copy(folioPivot).applyAxisAngle(turnAxis, angle).negate().add(folioPivot)
      world.current.updateMatrix()
      folioWorldToMap.value.copy(world.current.matrix).invert()
      if (Math.floor(angle * 7) !== Math.floor(lastAngle.current * 7)) gl.shadowMap.needsUpdate = true
      lastAngle.current = angle
    }
    camera.up.set(0, 1, 0)
    const phase = time <= 0 ? undefined : time < FOLIO.moonHold ? 'rise' : time < FOLIO.survey ? 'survey'
      : time < FOLIO.upright ? 'turn' : time < FOLIO.inkStart ? 'upright' : time < FOLIO.settled ? 'ink' : 'settled'
    if (phase && gl.domElement.dataset.finalePhase !== phase) gl.domElement.dataset.finalePhase = phase
    if (!phase && gl.domElement.dataset.finalePhase) delete gl.domElement.dataset.finalePhase

    if (ritual !== 'unfolding') foldProgress.current = ritual === 'summit' || ritual === 'moonrise' || ritual === 'ending' ? 1 : 0
    if (entry !== 'playing') {
      if (entry === 'painting') entryProgress.current = 0
      else entryProgress.current = Math.min(1, entryProgress.current + delta / STONE_PROLOGUE.duration)
      const progress = entryProgress.current
      const t = MathUtils.smootherstep(progress, .18, 1)
      entryPath.getPoint(t, camera.position)
      if (entry === 'painting') {
        parallax.current.x = pointer.x * .30
        parallax.current.y = pointer.y * .16
      }
      const remaining = 1 - MathUtils.smoothstep(progress, 0, .24)
      camera.position.x += parallax.current.x * remaining
      camera.position.y += parallax.current.y * remaining
      target.current.copy(stoneLook).lerp(valleyLook, MathUtils.smoothstep(t, .09, .48))
        .lerp(courtyardTarget, MathUtils.smoothstep(t, .62, 1))
      camera.lookAt(target.current)
      if (entryProgress.current >= 1) onEntry()
    } else if (ritual === 'cleared') {
      elapsed.current += delta
      const duration = 6.3
      // The last stretch is short in world units. Give the threshold and reveal enough screen time.
      const t = MathUtils.smootherstep(elapsed.current, 0, duration)
      gatePath.getPoint(t, camera.position)
      target.current.copy(courtyardTarget).lerp(throughGate, MathUtils.smoothstep(t, 0, .48))
        .lerp(cloudTarget, MathUtils.smoothstep(t, .67, .99))
      camera.lookAt(target.current)
      if (elapsed.current >= duration) rally.enterMountain()
    } else if (ritual === 'unfolding') {
      elapsed.current += delta
      foldProgress.current = Math.min(1, elapsed.current / 4.8)
      const t = MathUtils.smootherstep(foldProgress.current, .28, 1)
      unfoldPath.getPoint(t, camera.position)
      target.current.copy(cloudTarget).lerp(summitTarget, MathUtils.smoothstep(t, 0, 1))
      camera.lookAt(target.current)
      if (t >= 1) rally.enterSummit()
    } else if (time > 0) {
      elapsed.current = time
      if (time <= FOLIO.moonHold) {
        endingPath.getPoint(MathUtils.smootherstep(time, .30, 6.7), camera.position)
        const p = rally.position()
        risingBall.current.set(p.x, p.y + .30, p.z)
        risingBall.current.lerp(moonTarget, MathUtils.smoothstep(time, 1.55, 2.65))
        target.current.copy(summitTarget).lerp(risingBall.current, MathUtils.smootherstep(time, .20, 1.34))
          .lerp(vistaTarget, MathUtils.smoothstep(time, 2.34, 6.7))
      } else if (time < FOLIO.survey) {
        const travel = MathUtils.smoothstep(time, FOLIO.moonHold, FOLIO.survey)
        surveyPath.getPoint(travel, camera.position)
        target.current.copy(moonTarget).lerp(vistaTarget, MathUtils.smoothstep(FOLIO.moonHold, 2.34, 6.7))
          .lerp(surveyLook, travel)
      } else {
        camera.position.copy(surveyEye).lerp(portraitEye, turn)
        target.current.copy(surveyLook).lerp(portraitTarget, turn)
        camera.up.set(0, 1 - turn, -turn).normalize().applyAxisAngle(turnAxis, angle)
        camera.position.sub(folioPivot).applyAxisAngle(turnAxis, angle).add(folioPivot)
        target.current.sub(folioPivot).applyAxisAngle(turnAxis, angle).add(folioPivot)
      }
      camera.lookAt(target.current)
      if (ritual === 'moonrise' && time >= FOLIO.settled) rally.finishPainting()
    } else {
      const eye = ritual === 'mountain' ? cloudEye : ritual === 'summit' ? summitEye : ritual === 'ending' ? vistaEye : courtyardEye
      const look = ritual === 'mountain' ? cloudTarget : ritual === 'summit' ? summitTarget : ritual === 'ending' ? vistaTarget : courtyardTarget
      camera.position.copy(eye)
      camera.lookAt(look)
    }
    const wideView = MathUtils.smoothstep(time, 2, FOLIO.survey)
    const outside = entry === 'playing' ? 0 : 1 - MathUtils.smoothstep(entryProgress.current, .51, .86)
    if (scene.background instanceof Color) scene.background.copy(gardenSky).lerp(outsideSky, outside).lerp(inkSky, wideView)
    if (scene.fog instanceof Fog) {
      const cave = entry !== 'playing' || ritual === 'lotus' || ritual === 'bell' || ritual === 'passage'
      const valley = ritual === 'mountain' || ritual === 'unfolding' || ritual === 'summit' ? 1
        : ritual === 'cleared' ? MathUtils.smoothstep(-camera.position.z,19.5,24.5)
        : ritual === 'moonrise' ? 1 - wideView : 0
      scene.fog.color.copy(cave ? caveAir : gardenSky).lerp(caveAir,valley).lerp(outsideSky, outside).lerp(inkSky, wideView)
      scene.fog.near = MathUtils.lerp((cave ? 28 : 33) + outside * 17, 158, wideView)
      scene.fog.far = MathUtils.lerp(cave ? 132 + outside * 46 : 131, 345, wideView)
    }
    if (camera instanceof PerspectiveCamera) {
      const courtyard = ritual==='lotus' || ritual==='bell' || ritual==='passage'
      const courtWeight = entry!=='playing' ? MathUtils.smoothstep(entryProgress.current,.67,1)
        : courtyard ? 1 : ritual==='cleared' ? 1-MathUtils.smoothstep(elapsed.current,0,3) : 0
      const lunarWeight = ritual === 'summit' || ritual === 'moonrise' || ritual === 'ending' ? 1
        : ritual === 'unfolding' ? MathUtils.smoothstep(foldProgress.current, .51, 1) : 0
      const field = MathUtils.lerp(MathUtils.lerp(STONE_PROLOGUE.fov,gardenCamera.fov,courtWeight), SUMMIT.fov, lunarWeight)
      const fov = MathUtils.lerp(MathUtils.lerp(field, 52, wideView), FOLIO.portraitFov, turn)
      const far = MathUtils.lerp(170, 390, MathUtils.smoothstep(time, FOLIO.moonHold, FOLIO.survey))
      const leaveRoomForTitle = MathUtils.smootherstep(time, FOLIO.inkStart + .74, FOLIO.inkEnd)
      const filmOffset = turn * MathUtils.lerp(-1.35, FOLIO.portraitOffset, leaveRoomForTitle)
      if (camera.fov !== fov || camera.far !== far || camera.filmOffset !== filmOffset) {
        camera.fov = fov
        camera.far = far
        camera.filmOffset = filmOffset
        camera.updateProjectionMatrix()
      }
    }
    camera.updateMatrixWorld()
  }, -2)
  return null
}
