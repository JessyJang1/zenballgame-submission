import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { WebGLRenderer, type WebGLRendererParameters, MathUtils, type BufferAttribute, type Camera, type Group, type LineBasicMaterial, type LineSegments, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type PointLight } from 'three'
import { BALL_RADIUS, COURT, STEP, type Rally, type Ritual } from './rally'
import Garden from './Garden'
import SceneLighting from './SceneLighting'
import { startOpeningPrograms } from './assets/openingPrograms'
import ShaderWarmup from './ShaderWarmup'
import BallTrail from './BallTrail'
import CameraDirector from './CameraDirector'
import FrameBudget from './FrameBudget'
import Mountain from './Mountain'
import LongScroll from './LongScroll'
import StonePrologue from './StonePrologue'
import { CLOUD_TERRACE, SUMMIT, type Entry } from './paintingLayout'
import InkFigure from './InkFigure'
import GrottoHall from './GrottoHall'
import { AssetCatalog, AssetSlot } from './assets/AssetSlots'
import { gardenCamera } from './assets/pigment'
import { GATE, LOTUS, lotusAimSurface } from './gardenLayout'

const ignorePainting = () => {}
const previewOptions = new URLSearchParams(window.location.search)
const reviewWorld = previewOptions.get('debug') !== 'court'
const fullQuality = previewOptions.get('quality') === 'full'

function createCourtRenderer(defaults: WebGLRendererParameters) {
  const renderer = new WebGLRenderer({...defaults, antialias:true,alpha:false,
    powerPreference:fullQuality ? 'high-performance' : 'low-power'})
  if (reviewWorld && !previewOptions.has('shaderDiagnostics')) startOpeningPrograms(renderer.getContext())
  return renderer
}

const { halfWidth: W, halfLength: L, netHalfWidth, netHeight, netDepth, aimDepth } = COURT
const lineColor = '#f8d8ac'
const ballColor = '#e6d477'
const aimColor = '#d1bd82'
const opponentColor = '#7d9faa'
const impactColors = { bounce: ballColor, lotus: '#99e3d6', bell: '#ffc878', barrier: '#ef8b70', perfect: '#ffdb84', mountain: '#f0bb76', water: '#a6dec7' }
const skyGuideSegments = 16

// The same curved seam reappears on the moon at the summit. Filter it
// across the pixel footprint to keep distant returns clear of shimmer.
function weaveBallSeam(shader:Parameters<MeshStandardMaterial['onBeforeCompile']>[0]){
  shader.vertexShader='varying vec3 feltNormal;\n'+shader.vertexShader.replace('#include <beginnormal_vertex>',
    '#include <beginnormal_vertex>\n feltNormal=normal;')
  shader.fragmentShader='varying vec3 feltNormal;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
    #include <color_fragment>
    vec3 n=normalize(feltNormal);
    float line=abs(n.y-.58*(n.x*n.x-n.z*n.z));
    float width=max(fwidth(line),.006);
    float stitch=(1.-smoothstep(.033,.045+width,line))/(1.+3.*width);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.97,.90,.63),stitch);
  `)
}

const racketStrings: [number,number,number][]=[]
for(let i=-3;i<=3;i++) {
  const x=i*.055,y=Math.sqrt(.218*.218-x*x)
  racketStrings.push([x,-y,0],[x,y,0],[-y,x,0],[y,x,0])
}
const netGrid: number[] = []
for (let x = -netHalfWidth; x <= netHalfWidth; x += 0.19) {
  netGrid.push(x, 0.025, netDepth / 2, x, netHeight, netDepth / 2)
}
for (let y = 0.06; y < netHeight; y += 0.105) {
  netGrid.push(-netHalfWidth, y, netDepth / 2, netHalfWidth, y, netDepth / 2)
}
const netVertices = new Float32Array(netGrid)

function Surface() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.09}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial color="#1b322a" roughness={1} />
      </mesh>
      <mesh position={[0, -0.052, 0]}>
        <boxGeometry args={[11.9, 0.1, 23.6]} />
        <meshStandardMaterial color="#944d31" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} rotation-x={-Math.PI / 2} position={[0, 0.002, side * L / 2]}>
          <planeGeometry args={[W * 2, L]} />
          <meshStandardMaterial color={side === 1 ? '#be704a' : '#a9603e'} roughness={1} />
        </mesh>
      ))}
      <Line points={[[-W, .018, -L], [W, .018, -L], [W, .018, L], [-W, .018, L], [-W, .018, -L]]}
        color={lineColor} lineWidth={1.5} />
      {[-1, 1].map((side) => (
        <Line key={side} points={[[-W, .018, side * 4.65], [W, .018, side * 4.65]]}
          color={lineColor} lineWidth={1} transparent opacity={0.7} />
      ))}
      <Line points={[[0, .018, -4.65], [0, .018, 4.65]]}
        color={lineColor} lineWidth={1} transparent opacity={0.7} />
      <Net />
    </>
  )
}

function Net() {
  return (
    <group>
      <mesh position={[0, netHeight / 2, 0]}>
        <boxGeometry args={[netHalfWidth * 2, netHeight, netDepth]} />
        <meshStandardMaterial color="#19251f" transparent opacity={0.46} depthWrite={false} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[netVertices, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#d5bba1" transparent opacity={0.43} />
      </lineSegments>
      <mesh position={[0, netHeight - .025, 0]}>
        <boxGeometry args={[netHalfWidth * 2, .05, .115]} />
        <meshStandardMaterial color="#f6e2c4" />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * netHalfWidth, .605, 0]}>
          <cylinderGeometry args={[.055, .065, 1.21, 12]} />
          <meshStandardMaterial color="#c8d5b9" />
        </mesh>
      ))}
    </group>
  )
}

function Player({ root, racket, rally, frameTime, away, garden }: {
  rally: Rally
  root: RefObject<Group | null>
  racket: RefObject<Group | null>
  frameTime: RefObject<number>
  away?: boolean
  garden?: boolean
}) {
  const color = away ? opponentColor : aimColor
  return (
    <group ref={root} name={away ? 'Shadow catcher' : 'Near player'} position={[away ? -.4 : -.1, 0, away ? -7.9 : 8.1]}>
      {!garden && <mesh rotation-x={-Math.PI / 2} position-y={0.021}>
        <circleGeometry args={[.64, 32]} />
        <meshBasicMaterial color="#39251e" transparent opacity={.48} />
      </mesh>}
      <group rotation-y={away ? Math.PI : 0}>
        {garden ? <>
          <mesh rotation-x={-Math.PI/2} position={[-.06,.013,.015]}>
            <planeGeometry args={[1.86,1.15]}/>
            <shaderMaterial transparent depthWrite={false}
              vertexShader="varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
              fragmentShader="varying vec2 st;void main(){vec2 p=st-.5;float r=length(p*vec2(1.,1.32));gl_FragColor=vec4(.035,.028,.021,.55*(1.-smoothstep(.14,.49,r)));}"/>
          </mesh>
          <AssetSlot slot={away ? 'shadow' : 'player'} motion={() => {
            const seconds = rally.time - (away ? rally.lastShadowSwing : rally.lastSwing)
            return seconds >= 0 && seconds <= .74 ? { clip: 'Swing', seconds } : { clip: 'Idle', seconds: rally.time, loop: true }
          }}>
            <InkFigure away={away} rally={rally} actorRoot={root} frameTime={frameTime} />
          </AssetSlot>
        </> : <>
          <mesh position-y={.57}>
            <capsuleGeometry args={[.255, .53, 6, 12]} />
            <meshStandardMaterial color={away ? '#253445' : '#283e35'} roughness={.82} />
          </mesh>
          <mesh position-y={.95}>
            <cylinderGeometry args={[.26, .27, .12, 20]} />
            <meshStandardMaterial color={color} roughness={.8} />
          </mesh>
          <mesh position-y={1.18}>
            <sphereGeometry args={[.235, 20, 12]} />
            <meshStandardMaterial color={color} roughness={.72} />
          </mesh>
          <group ref={racket} position={[.23, .74, -.03]} rotation-y={.3}>
            <AssetSlot slot="racket">
              <mesh position={[.24, .17, 0]} rotation-z={-.91}>
                <cylinderGeometry args={[.042, .048, .61, 10]} />
                <meshStandardMaterial color="#ede2cf" />
              </mesh>
              <mesh position={[.54, .41, 0]} rotation-z={-.65} scale={[.83, 1.12, 1]}>
                <torusGeometry args={[.243, .025, 8, 24]} />
                <meshStandardMaterial color={color} />
              </mesh>
              <group position={[.54,.41,.003]} rotation-z={-.65} scale={[.83,1.12,1]}>
                <Line points={racketStrings} segments color="#c2b88c" lineWidth={.6} transparent opacity={.65}/>
              </group>
            </AssetSlot>
          </group>
        </>}
      </group>
    </group>
  )
}

function CourtAction({ rally, progress, ritual, frameTime, paused = false, visible = true, bellReveal }: {
  rally: Rally
  progress: RefObject<HTMLDivElement | null>
  ritual?: Ritual
  frameTime: RefObject<number>
  paused?: boolean
  visible?: boolean
  bellReveal?: RefObject<number>
}) {
  const accumulated = useRef(0)
  const lastRitual=useRef(rally.getStatus().ritual)
  const passageBeat=useRef(1)
  const passageOrigin=useRef({x:0,z:0})
  const ball = useRef<Group>(null)
  const ballMaterial = useRef<MeshStandardMaterial>(null)
  const shadow = useRef<Mesh>(null)
  const shadowMaterial = useRef<MeshBasicMaterial>(null)
  const swingHalo = useRef<Mesh>(null)
  const groundAim = useRef<Group>(null)
  const aimDot = useRef<MeshBasicMaterial>(null)
  const serveFooting = useRef<Mesh>(null)
  const spawnRipple = useRef<Mesh>(null)
  const serveAge = useRef(0)
  const aimRing = useRef<MeshBasicMaterial>(null)
  const skyAimRing = useRef<MeshBasicMaterial>(null)
  const skyArc = useRef<LineSegments>(null)
  const skyArcMaterial = useRef<LineBasicMaterial>(null)
  const skyPositions = useMemo(() => new Float32Array(skyGuideSegments * 6), [])
  const skyAim = useRef({ x: NaN, y: NaN })
  const landing = useRef<Group>(null)
  const landingRing = useRef<MeshBasicMaterial>(null)
  const impactDisplay = useRef({ contact: rally.impact, age: Infinity })
  const hit = useRef<Mesh>(null)
  const hitMaterial = useRef<MeshBasicMaterial>(null)
  const player = useRef<Group>(null)
  const playerRacket = useRef<Group>(null)
  const opponent = useRef<Group>(null)
  const opponentRacket = useRef<Group>(null)

  useFrame(({ camera }, delta) => {
    // Keep a single simulation clock for collisions, cues, and the swing window.
    const stage=rally.getStatus().ritual
    if (lastRitual.current !== stage) {
      passageBeat.current = stage==='passage' && player.current ? 0 : 1
      if (player.current) {
        passageOrigin.current.x = player.current.position.x
        passageOrigin.current.z = player.current.position.z
      }
    }
    lastRitual.current=stage
    accumulated.current += frameTime.current
    while (accumulated.current >= STEP) {
      rally.step()
      accumulated.current -= STEP
    }
    const { phase, ritual: currentRitual, mountainWindow } = rally.getStatus()
    const atGate = currentRitual === 'passage' || currentRitual === 'cleared'
    const p = rally.position()
    const v = rally.velocity()
    const prediction = rally.landing()
    const upland = currentRitual === 'summit'
    const moon = currentRitual === 'moonrise' || currentRitual === 'ending'
    const beyond = currentRitual === 'mountain' || currentRitual === 'unfolding' || upland || moon
    const platform = upland || moon ? SUMMIT : CLOUD_TERRACE
    const surfaceY = beyond ? platform.y : 0
    const canSwing = phase === 'window'
    const effectiveSwing = canSwing && (currentRitual !== 'mountain' || mountainWindow !== 'late')
    const landingPulse = effectiveSwing ? 1.16 + Math.sin(rally.time * 20) * .10 : 1
    // Water faults and successful mechanisms stop the simulation clock
    // immediately. Let their brief surface response finish during settle frames.
    const display = impactDisplay.current
    if (display.contact !== rally.impact) {
      display.contact = rally.impact
      display.age = Number.isFinite(rally.lastImpact) ? 0 : Infinity
    } else if (!paused) display.age += Math.min(delta,.10)
    const impactAge = display.age

    if (ball.current) {
      ball.current.visible = !(phase === 'ended' && rally.getStatus().fault === 'water') && (!moon || rally.moonProgress() < .34)
      ball.current.position.set(p.x, p.y, p.z)
      ball.current.rotation.z = -.55
      ball.current.rotation.y = rally.time * 2.4
      ball.current.scale.setScalar(moon
        ? MathUtils.lerp(1, SUMMIT.moon.radius / BALL_RADIUS, MathUtils.smoothstep(rally.moonProgress(), .34, 1))
        : 1)
    }
    if (ballMaterial.current) {
      ballMaterial.current.color.set(moon ? '#fce7b6' : ballColor)
      if (ballMaterial.current.fog === moon) {
        ballMaterial.current.fog = !moon
        ballMaterial.current.needsUpdate = true
      }
    }
    if (shadow.current) {
      shadow.current.visible = !moon && !(phase === 'ended' && rally.getStatus().fault === 'water')
      shadow.current.position.set(p.x, surfaceY + .025, p.z)
      shadow.current.scale.setScalar(1 + p.y * .16)
      if (shadowMaterial.current) shadowMaterial.current.opacity = .58 / (1 + p.y * .31)
    }
    if (swingHalo.current) {
      swingHalo.current.visible = effectiveSwing
      swingHalo.current.position.set(p.x, p.y, p.z)
      swingHalo.current.quaternion.copy(camera.quaternion)
      const opens = currentRitual === 'mountain' && effectiveSwing
        ? 1 + .42 * (1 - MathUtils.smoothstep(rally.progression(),0,.30))
        : 1
      swingHalo.current.scale.setScalar(landingPulse * opens)
    }
    const lotusReady = visible && currentRitual === 'lotus' && phase === 'ready'
    const aimSurface = lotusReady ? lotusAimSurface(rally.aim, rally.aimZ) : 'stone'
    if (groundAim.current) {
      const gateRatio = (GATE.z - GATE.tee.z) / (GATE.targetZ - GATE.tee.z)
      const face = SUMMIT.aperture.z + SUMMIT.aperture.depth / 2 + .028
      const faceDepth = upland ? (face - camera.position.z) / (SUMMIT.aperture.z - camera.position.z) : 1
      groundAim.current.position.set(
        atGate ? GATE.tee.x + (rally.aim - GATE.tee.x) * gateRatio :
          upland ? MathUtils.lerp(camera.position.x, rally.aim, faceDepth) : rally.aim,
        atGate ? 1.63 : upland ? MathUtils.lerp(camera.position.y, rally.aimY, faceDepth) : aimSurface === 'heart' ? LOTUS.height + .79 : surfaceY + .048,
        atGate ? GATE.z + .35 : upland ? face : rally.aimZ,
      )
      groundAim.current.rotation.x = atGate ? camera.rotation.x + Math.PI / 2 : upland ? Math.PI / 2 : 0
      const findingBell = currentRitual === 'bell' && bellReveal && bellReveal.current < 1
      groundAim.current.visible = !findingBell && phase !== 'ended' && (!(atGate || upland) || phase === 'ready')
    }
    const centered = upland && phase === 'ready' && rally.skyAimCentered()
    const reticleColor = aimSurface === 'heart' ? '#ffe2a0' : aimSurface === 'water' ? '#9edacf' : aimColor
    aimDot.current?.color.set(reticleColor)
    aimRing.current?.color.set(aimSurface !== 'stone' ? reticleColor : centered ? '#f9e8ab' : !atGate && !beyond && Math.abs(rally.aim) > W + BALL_RADIUS ? '#ff9c76' : aimColor)
    if (upland && aimRing.current) skyAimRing.current?.color.copy(aimRing.current.color)
    if (!paused) serveAge.current = lotusReady ? serveAge.current + Math.min(delta,.06) : 0
    if (serveFooting.current && spawnRipple.current) {
      serveFooting.current.visible = lotusReady
      serveFooting.current.position.set(p.x-.63,.029,p.z+.54)
      const groundInk = serveFooting.current.material as MeshBasicMaterial
      groundInk.opacity = .26 + .32 * (1 - MathUtils.smoothstep(serveAge.current,0,1))
      spawnRipple.current.visible = lotusReady && serveAge.current < .65
      spawnRipple.current.position.copy(p)
      spawnRipple.current.quaternion.copy(camera.quaternion)
      spawnRipple.current.scale.setScalar(.68 + serveAge.current * 1.5)
      const airInk = spawnRipple.current.material as MeshBasicMaterial
      airInk.opacity = .68 * (1 - MathUtils.smoothstep(serveAge.current,0,.65))
    }
    if (skyArc.current) {
      skyArc.current.visible = upland && phase === 'ready'
      if (skyArc.current.visible && (skyAim.current.x !== rally.aim || skyAim.current.y !== rally.aimY)) {
        skyAim.current.x = rally.aim
        skyAim.current.y = rally.aimY
        const positions = skyArc.current.geometry.getAttribute('position') as BufferAttribute
        for (let i = 0; i < skyGuideSegments; i++) {
          const start = .15 + .81 * i / skyGuideSegments
          const a = rally.skyShotPoint(start, p)
          const b = rally.skyShotPoint(start + .028, p)
          positions.setXYZ(i * 2, a.x, a.y, a.z)
          positions.setXYZ(i * 2 + 1, b.x, b.y, b.z)
        }
        positions.needsUpdate = true
        if (skyArcMaterial.current) skyArcMaterial.current.opacity = centered ? .86 : .36
      }
    }
    if (landing.current) {
      landing.current.visible = prediction !== null && !atGate && (!beyond || currentRitual === 'mountain')
      if (prediction) landing.current.position.set(prediction.x, prediction.y + .033, prediction.z)
      landing.current.scale.setScalar(landingPulse)
    }
    landingRing.current?.color.set(effectiveSwing ? ballColor : '#ffe8bd')
    if (hit.current && hitMaterial.current) {
      const water = rally.impactKind === 'water'
      const life = water ? .87 : .39
      hit.current.visible = impactAge < life
      if (hit.current.visible) {
        const kind = rally.impactKind
        const flat = kind === 'bounce' || kind === 'lotus' || kind === 'water'
        if (flat) hit.current.rotation.set(-Math.PI / 2, 0, 0)
        else hit.current.quaternion.copy(camera.quaternion)
        hit.current.position.set(rally.impact.x, kind === 'bounce' ? rally.impact.y - BALL_RADIUS + .012 : rally.impact.y + .035, rally.impact.z)
        hit.current.scale.setScalar((kind === 'lotus' ? 1.2 : .58) + impactAge * (water ? 2.5 : 4.4))
        hitMaterial.current.color.set(impactColors[kind])
        hitMaterial.current.opacity = Math.max(0, .95 * (1 - impactAge / life))
      }
    }
    if (player.current && opponent.current) {
      const playerX = (phase === 'incoming' || canSwing) && prediction
        ? (canSwing ? p.x : prediction.x + v.x * .32) - .68
        : player.current.position.x
      const playerZ = (phase === 'incoming' || canSwing) && prediction
        ? (canSwing ? p.z : prediction.z + v.z * .32) + .24
        : player.current.position.z
      const shadowX = !atGate && phase === 'outbound' && prediction
        ? prediction.x + v.x * .29 + .65
        : currentRitual === 'mountain' ? CLOUD_TERRACE.x : opponent.current.position.x
      const shadowZ = !atGate && phase === 'outbound' && prediction
        ? prediction.z + v.z * .29 - .24
        : opponent.current.position.z
      player.current.position.y = surfaceY
      const onCloudCourt = currentRitual === 'mountain' && phase !== 'ready'
      const receivingOnCloud = onCloudCourt && (phase === 'incoming' || canSwing)
      // Give the back foot room in the fixed court camera while keeping very late
      // returns in reach. These limits only place the rendered actor.
      const cloudStanceZ = receivingOnCloud ? Math.min(playerZ, Math.max(CLOUD_TERRACE.tee.z + .24, p.z - .67)) : playerZ
      player.current.position.x = onCloudCourt
        ? MathUtils.damp(player.current.position.x, MathUtils.clamp(playerX, CLOUD_TERRACE.x - 4.8, CLOUD_TERRACE.x + 4.8), 9, delta)
        : beyond ? platform.tee.x - .67 : atGate ? GATE.tee.x - .66 : phase === 'ready' ? -.1
        : MathUtils.damp(player.current.position.x, MathUtils.clamp(playerX, -4.5, 4.5), 7, delta)
      player.current.position.z = onCloudCourt
        ? MathUtils.damp(player.current.position.z, MathUtils.clamp(cloudStanceZ, CLOUD_TERRACE.rallyMidZ + .4, CLOUD_TERRACE.z + 8.1), 10, delta)
        : beyond ? platform.tee.z + .35 : atGate ? GATE.tee.z + .35 : phase === 'ready' ? 8.1
        : MathUtils.damp(player.current.position.z, MathUtils.clamp(playerZ, 5.2, 10.2), 9, delta)
      if (atGate && passageBeat.current < 1) {
        passageBeat.current = Math.min(1,passageBeat.current + Math.min(delta,.05)/.88)
        const t = passageBeat.current
        const step = MathUtils.smootherstep(t,.11,.88)
        player.current.position.x = MathUtils.lerp(passageOrigin.current.x,GATE.tee.x-.66,step)
        player.current.position.z = MathUtils.lerp(passageOrigin.current.z,GATE.tee.z+.35,step)
        // The visible figure slips through an ink stroke while the ball
        // is already resting at the threshold.
        player.current.scale.setScalar(1-.93*Math.sin(Math.PI*step)**2)
        player.current.position.y = .22*Math.sin(Math.PI*step)
      } else player.current.scale.setScalar(1)
      opponent.current.visible = !atGate && (!beyond || currentRitual === 'mountain')
      opponent.current.position.y = currentRitual === 'mountain' ? surfaceY : 0
      const shadowWaitingOnCloud = currentRitual === 'mountain' && phase === 'ready'
      opponent.current.position.x = shadowWaitingOnCloud ? CLOUD_TERRACE.x : currentRitual === 'mountain'
        ? MathUtils.damp(opponent.current.position.x, MathUtils.clamp(shadowX, CLOUD_TERRACE.x - 4.8, CLOUD_TERRACE.x + 4.8), 8, delta)
        : phase === 'ready' ? -.4
        : MathUtils.damp(opponent.current.position.x, MathUtils.clamp(shadowX, -4.8, 4.8), 6, delta)
      opponent.current.position.z = shadowWaitingOnCloud ? CLOUD_TERRACE.z - 5 : currentRitual === 'mountain'
        ? MathUtils.damp(opponent.current.position.z, phase === 'outbound' && prediction
          ? MathUtils.clamp(prediction.z - .24, CLOUD_TERRACE.z - 8, CLOUD_TERRACE.rallyMidZ - .5) : CLOUD_TERRACE.z - 5, 9, delta)
        : phase === 'ready' ? -7.9
        : MathUtils.damp(opponent.current.position.z, MathUtils.clamp(shadowZ, -9.4, -6.5), 6, delta)
      if (playerRacket.current) moveDebugRacket(playerRacket.current,rally.time-rally.lastSwing)
      if (opponentRacket.current) moveDebugRacket(opponentRacket.current,rally.time-rally.lastShadowSwing)
    }
    if (progress.current) {
      progress.current.style.setProperty('--remaining', canSwing ? String(1 - rally.progression()) : '0')
    }
  }, -.5)

  const fallback = <Player rally={rally} root={player} racket={playerRacket} frameTime={frameTime} garden={!!ritual} />
  return (
    <>
      {fallback}
      <Player rally={rally} root={opponent} racket={opponentRacket} frameTime={frameTime} away garden={!!ritual} />
      {!ritual && (
        <Line points={[[-COURT.aimLimit, .045, aimDepth], [COURT.aimLimit, .045, aimDepth]]}
          color={aimColor} lineWidth={1} dashed dashSize={.18} gapSize={.16} transparent opacity={.76} />
      )}
      <group ref={groundAim} position={[0, .048, aimDepth]} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          {ritual === 'summit' ? <ringGeometry args={[.245, .270, 16, 1, -.45, .90]} /> : <ringGeometry args={[.38, .45, 32]} />}
          <meshBasicMaterial ref={aimRing} color={aimColor} />
        </mesh>
        {ritual === 'summit' && <mesh rotation-x={-Math.PI / 2}>
          <ringGeometry args={[.245, .270, 16, 1, Math.PI - .45, .90]} />
          <meshBasicMaterial ref={skyAimRing} color={aimColor} />
        </mesh>}
        <mesh rotation-x={-Math.PI / 2} position-y={.003}>
          <circleGeometry args={[ritual === 'summit' ? .048 : .095, 16]} />
          <meshBasicMaterial ref={aimDot} color={aimColor} />
        </mesh>
      </group>
      <mesh ref={serveFooting} visible={false} rotation-x={-Math.PI / 2} name="First serve footing in warm ink">
        <ringGeometry args={[.52,.56,28,1,Math.PI*.13,Math.PI*1.53]}/>
        <meshBasicMaterial color="#dfbe83" transparent depthWrite={false}/>
      </mesh>
      <mesh ref={spawnRipple} visible={false} name="First serve ball restored">
        <ringGeometry args={[.20,.225,24]}/>
        <meshBasicMaterial color="#f6dfa0" transparent depthWrite={false}/>
      </mesh>
      {ritual === 'summit' && <lineSegments ref={skyArc} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[skyPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial ref={skyArcMaterial} color="#f8dc9d" transparent opacity={.36} depthWrite={false} />
      </lineSegments>}
      <group ref={landing} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <ringGeometry args={[.49, .56, 32]} />
          <meshBasicMaterial ref={landingRing} color="#ffe8bd" transparent opacity={.93} />
        </mesh>
      </group>
      <mesh ref={hit} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[.38, .43, 28]} />
        <meshBasicMaterial ref={hitMaterial} color={ballColor} transparent depthWrite={false} />
      </mesh>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[.19, 24]} />
        <meshBasicMaterial ref={shadowMaterial} color="#301d18" transparent depthWrite={false} />
      </mesh>
      <mesh ref={swingHalo} visible={false}>
        <ringGeometry args={[.30, .34, 24]} />
        <meshBasicMaterial color={ballColor} toneMapped={false} transparent opacity={.87} />
      </mesh>
      <BallTrail key={rally.flightId} color={ballColor}>
        <group ref={ball} name="Rally ball" position={[.62, 1.31, 7.35]}>
          <AssetSlot slot="ball" sphere={BALL_RADIUS * 2}>
              <mesh>
                <sphereGeometry args={[BALL_RADIUS, 24, 16]} />
                <meshStandardMaterial ref={ballMaterial} color={ballColor} roughness={.92}
                  emissive="#9c801e" emissiveIntensity={.55} onBeforeCompile={weaveBallSeam} />
              </mesh>
          </AssetSlot>
        </group>
      </BallTrail>
    </>
  )
}

function moveDebugRacket(racket:Group,age:number){
  racket.rotation.y=.29+(age>=0&&age<=.3?Math.sin(Math.PI*age/.3)*1.95:0)
}

function BellRevealSignal({ reveal, onChange }: { reveal: RefObject<number>; onChange: (shown: boolean) => void }) {
  const last = useRef(false)
  useFrame(() => {
    const shown = reveal.current >= 1
    if (shown !== last.current) {
      last.current = shown
      onChange(shown)
    }
  })
  return null
}

export default function Court({ attempt, awake = false, paused = false, aimCamera, entry = 'playing', onEntry = ignorePainting, onTouchStone = ignorePainting, openingServe, onServeSound, stoneReady = false, onWorldReady = ignorePainting, bellReveal, onBellReveal, ...props }: Omit<Parameters<typeof CourtAction>[0], 'frameTime'> & {
  attempt: number
  awake?: boolean
  paused?: boolean
  aimCamera?: RefObject<Camera | null>
  entry?: Entry
  onEntry?: () => void
  stoneReady?: boolean
  openingServe?: RefObject<(() => void) | null>
  onServeSound?: () => void
  onTouchStone?: () => void
  onWorldReady?: () => void
  bellReveal?: RefObject<number>
  onBellReveal?: (shown: boolean) => void
}) {
  const garden = props.ritual !== undefined
  const [assembly, setAssembly] = useState(entry === 'painting' && garden ? 0 : 4)
  useEffect(() => {
    if (assembly >= 4) return
    const frame = requestAnimationFrame(() => setAssembly(assembly + 1))
    return () => cancelAnimationFrame(frame)
  }, [assembly])
  const frameTime = useRef(0)
  const folioTime = useRef(0)
  const paintedWorld = useRef<Group>(null)
  const entryProgress = useRef(0)
  const foldProgress = useRef(0)
  const wakeLamp = useRef<PointLight>(null)
  const beforeMountain = entry !== 'playing' || ['lotus', 'bell', 'passage', 'cleared'].includes(props.ritual ?? '')
  const revisitThreshold = props.ritual === 'moonrise' || props.ritual === 'ending'
  return (
    <Canvas
      frameloop="demand"
      shadows={reviewWorld}
      dpr={fullQuality ? [1, 1.55] : 1}
      gl={createCourtRenderer}
      camera={{ position: garden ? [...gardenCamera.position] : [0, 19.1, 22.5], fov: garden ? gardenCamera.fov : 40, near: .1, far: 170 }}
      onCreated={({ camera, gl }) => {
        // Driver info-log queries synchronously drain the GPU queue on WebKit.
        // Keep full shader diagnostics for development and explicit QA sessions.
        gl.debug.checkShaderErrors = import.meta.env.DEV || new URLSearchParams(location.search).has('shaderDiagnostics')
        gl.shadowMap.autoUpdate=false
        gl.shadowMap.needsUpdate=true
        if (garden) camera.lookAt(...gardenCamera.target)
        else camera.lookAt(0, 0, -.55)
        camera.updateMatrixWorld()
        if (aimCamera) aimCamera.current = camera
      }}
    >
      <FrameBudget paused={paused} rally={props.rally} entry={entry} fps={fullQuality ? 60 : 30} frameTime={frameTime} bellReveal={bellReveal} />
      <color attach="background" args={[garden ? (reviewWorld ? '#244c40' : '#c9d1b3') : '#20372d']} />
      {garden && <fog attach="fog" args={[reviewWorld ? '#244c40' : '#c9d1b3', 33, 131]} />}
      {reviewWorld && props.ritual ? <SceneLighting ritual={props.ritual} entry={entry} entryProgress={entryProgress}
        world={paintedWorld} folioTime={folioTime}/> : garden ? <hemisphereLight args={['#f6edda', '#263d34', 1.25]} /> : <ambientLight intensity={1.65} />}
      {!reviewWorld && <directionalLight position={[-7, 12, 6]} intensity={garden ? 1.8 : 2.25} color="#ffebca" />}
      {props.ritual ? (
        <AssetCatalog>
          <CameraDirector rally={props.rally} entry={entry} entryProgress={entryProgress} foldProgress={foldProgress}
            frameTime={frameTime} folioTime={folioTime} world={paintedWorld} onEntry={onEntry} />
          {/* Keep the light count stable when the prologue geometry leaves the scene.
              Its intensity reaches zero well before the mountain transition. */}
          <pointLight ref={wakeLamp} color="#ffca72" position={[0,3.4,44]} intensity={11} distance={17} decay={2}/>
          {beforeMountain && <Suspense fallback={null}><StonePrologue wakeLamp={wakeLamp} openingServe={openingServe} onServeSound={onServeSound} progress={entryProgress} onTouch={onTouchStone} ready={entry === 'painting' && stoneReady} /></Suspense>}
          <group ref={paintedWorld} name="Playable painted world">
              {revisitThreshold && <Suspense fallback={null}>
                <StonePrologue progress={entryProgress} onTouch={ignorePainting} ready={false} wakeLamp={wakeLamp} folioView />
              </Suspense>}
              {assembly >= 1 && <GrottoHall ritual={props.ritual}/>}
              {assembly >= 2 && <Garden ritual={props.ritual} awake={awake} rally={props.rally} bellReveal={bellReveal} paused={paused} />}
              {bellReveal && onBellReveal && <BellRevealSignal reveal={bellReveal} onChange={onBellReveal} />}
              {assembly >= 3 && <Mountain ritual={props.ritual} foldProgress={foldProgress} rally={props.rally} />}
              {assembly >= 4 && <LongScroll rally={props.rally} folioTime={folioTime}/>}
              <group visible={entry === 'playing'}>
                <CourtAction key={attempt} {...props} frameTime={frameTime} paused={paused} visible={entry === 'playing'} bellReveal={bellReveal} />
              </group>
          </group>
          <ShaderWarmup assembled={assembly === 4} entry={entry} onReady={onWorldReady}/>
        </AssetCatalog>
      ) : (
        <>
          <Surface />
          <CourtAction key={attempt} {...props} frameTime={frameTime} paused={paused} />
        </>
      )}
    </Canvas>
  )
}
