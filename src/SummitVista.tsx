import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Color, DoubleSide, MathUtils, PlaneGeometry, ShaderMaterial, type Group, type Mesh } from 'three'
import type { Rally, Ritual } from './rally'
import { SUMMIT } from './paintingLayout'

import { openingGeometry } from './assets/openingGeometry'

const noise = `
  float inkHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float inkNoise(vec2 p) {
    vec2 k = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(inkHash(k), inkHash(k + vec2(1., 0.)), f.x),
               mix(inkHash(k + vec2(0., 1.)), inkHash(k + 1.), f.x), f.y);
  }
`

const skyVertex = `
  varying vec3 vPaperPoint;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.);
    vPaperPoint = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const skyFragment = `
  varying vec3 vPaperPoint;
  uniform float reveal;
  uniform float lunar;
  uniform float moonAir;
  uniform vec3 skyShade;
  uniform vec3 skyPaper;
  uniform vec3 skyGold;
  uniform vec3 nightZenith;
  uniform vec3 nightHorizon;
  uniform vec3 nightPearl;
  uniform vec3 skyOpening;
  ${noise}
  void main(){
    vec3 view = normalize(vPaperPoint - cameraPosition);
    vec2 stroke = vec2(view.x, view.y);
    float pale = 1. - smoothstep(.005, .46, view.y);
    float warm = exp(-8. * dot(stroke - vec2(-.36, .28), stroke - vec2(-.36, .28)));
    float vapor = inkNoise(stroke * vec2(9., 19.) + vec2(10., 4.))
      * .64 + inkNoise(stroke * vec2(16., 33.) + 14.) * .36;
    float veil = (.24 + .18 * warm) * smoothstep(.39, .80, vapor) * smoothstep(-.22, .06, view.y);
    vec3 color = mix(skyShade, skyPaper, clamp(pale * .82 + veil, 0., 1.));
    color = mix(color, skyGold, .41 * warm);
    color = mix(color, color * vec3(.62,.64,.88) + vec3(.09,.036,.008) * warm, lunar);
    if (moonAir > .001) {
      // The break in the cloud bank stays over the ravine during the pullback.
      vec3 windowRay = normalize(skyOpening - cameraPosition);
      vec2 opening = view.xy - windowRay.xy;
      float windFold = (vapor - .5) * .14;
      float side = opening.x - opening.y * .66 + windFold;
      float slit = exp(-27. * side * side - 6. * opening.y * opening.y)
        * smoothstep(-.44,-.08,opening.y);
      float rimAir = exp(-13. * side * side - 3.6 * opening.y * opening.y)
        * smoothstep(-.57,-.19,opening.y);
      float horizon = 1. - smoothstep(-.23,.28,view.y);
      vec3 night = mix(nightZenith,nightHorizon,horizon * .85);
      vec2 cirrusFlow = vec2(stroke.x * 9. + stroke.y * 11., stroke.y * 64. - stroke.x * 12.);
      float scallop = inkNoise(cirrusFlow * .58);
      float filaments = inkNoise(cirrusFlow + vec2(scallop * 2.5, 1.));
      float cirrus = smoothstep(.49,.80,filaments * .66 + scallop * .34)
        * smoothstep(-.22,.14,view.y) * (1. - smoothstep(.32,.61,view.y));
      night = mix(night,nightPearl,clamp(slit * (.55 + .09 * lunar) + rimAir * .16,0.,.8));
      night += vec3(.20,.177,.158) * cirrus * (.10 + slit * .64);
      color = mix(color,night,moonAir);
    }
    color += (inkHash(gl_FragCoord.xy) - .5) * .009;
    gl_FragColor = vec4(color, reveal);
    #include <colorspace_fragment>
  }
`

const rockVertex = `
  attribute vec3 color;
  uniform float moonAir;
  varying vec3 vRockPoint;
  varying vec3 vRockNormal;
  varying vec3 vPigment;
  void main(){
    vec4 world = modelMatrix * vec4(position, 1.);
    // Small discontinuities on the summit silhouette reveal sheets of schist.
    float ledges = sin(position.y * .68 + position.x * .19 + position.z * .28)
      + .42 * sin(position.y * 1.53 - position.x * .41);
    world.xyz += normalize(mat3(modelMatrix) * normal) * ledges * .21 * moonAir;
    vRockPoint = world.xyz;
    vRockNormal = normalize(mat3(modelMatrix) * normal);
    vPigment = color;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const rockFragment = `
  varying vec3 vRockPoint;
  varying vec3 vRockNormal;
  varying vec3 vPigment;
  uniform float reveal;
  uniform float moonAir;
  uniform vec3 jadeMist;
  uniform vec3 paperMist;
  ${noise}
  void main(){
    vec3 normal = normalize(vRockNormal);
    vec3 light = normalize(vec3(-.69, .42, -.47));
    float diffuse = max(0., dot(normal, light));
    float grazing = max(0., dot(normal, normalize(vec3(-.94, .23, .21))));
    vec2 cut = vec2(vRockPoint.x + .57 * vRockPoint.z, vRockPoint.y);
    float warp = inkNoise(cut * vec2(.33, .16));
    float crease = abs(sin(cut.x * 2.4 - cut.y * .48 + warp * 2.5));
    float ridgelight = smoothstep(.50, .88, sin(cut.y * 2.8 + cut.x * .39 + warp * 3.));
    float fissure = (1. - smoothstep(.04, .20, crease)) * smoothstep(.29, .76, warp);
    float deposit = smoothstep(.46, .78, inkNoise(cut * vec2(.62, .95)));
    vec3 rock = vPigment * (.66 + diffuse * .72 + grazing * .28) * (.91 + .23 * warp - .13 * fissure);
    rock += vec3(.13, .086, .038) * deposit * (grazing + .24 * ridgelight);
    float breadth = smoothstep(46., 126., distance(vRockPoint, cameraPosition));
    float groundFog = 1. - smoothstep(-3., 16., vRockPoint.y);
    float air = clamp(.048 + breadth * .57 + groundFog * .42, .0, .94);
    vec3 mist = mix(jadeMist, paperMist, clamp(.11 + breadth * .23 + groundFog * .52, .0, 1.));
    if (moonAir > .001) {
      vec2 grain = vec2(cut.x + .25 * cut.y, cut.y - .37 * cut.x);
      float grainWarp = inkNoise(grain * vec2(.27,.66));
      float chipped = inkNoise(grain * vec2(1.42,2.1) + grainWarp * 1.8);
      float bed = grain.y * 3.9 + grainWarp * 7.1 + chipped * 1.55;
      float split = sin(bed);
      float cutEdge = smoothstep(.65,.97,split) * smoothstep(.39,.82,chipped);
      float recess = smoothstep(.56,.94,-split) * (.48 + .52 * fissure);
      vec3 cutNormal = normalize(normal + vec3(-.12,.22,-.12) * cos(bed) * grainWarp);
      float litFace = smoothstep(.05,.76,dot(cutNormal,normalize(vec3(-.55,.62,-.35))));
      vec3 blueStone = rock * vec3(.31,.44,.72) * (.62 + litFace * .52 - recess * .33);
      blueStone += vec3(.11,.118,.157) * litFace * (.37 + cutEdge * .73);
      rock = mix(rock,blueStone,moonAir);
      air *= mix(1., .78 + groundFog * .16,moonAir);
    }
    gl_FragColor = vec4(mix(rock, mist, air), reveal);
    #include <colorspace_fragment>
  }
`

const cloudVertex = `
  varying vec3 vVaporPoint;
  varying vec2 vEdgeUV;
  uniform float wind;
  void main(){
    vEdgeUV = uv;
    vec3 wave = position;
    wave.z += .6 * sin(position.x * .08 + position.y * .105 + wind * .24)
      + .35 * cos(position.y * .2 - position.x * .073);
    vec4 world = modelMatrix * vec4(wave, 1.);
    vVaporPoint = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const cloudFragment = `
  varying vec3 vVaporPoint;
  varying vec2 vEdgeUV;
  uniform float reveal;
  uniform float wind;
  uniform float weight;
  uniform float moonAir;
  uniform vec3 mistBase;
  uniform vec3 mistLid;
  ${noise}
  void main(){
    vec2 current = vVaporPoint.xz * vec2(.045, .112)
      + vec2(wind * .041, -wind * .025) + vVaporPoint.y * vec2(.18, -.068);
    float vapor = inkNoise(current) * .69 + inkNoise(current * 2.14 + 7.) * .24
      + inkNoise(current * 4.91 - 16.) * .07;
    vec2 edge = min(vEdgeUV, 1. - vEdgeUV);
    float dissolve = smoothstep(.0, .22, edge.x) * smoothstep(.0, .19, edge.y);
    if (moonAir > .001) {
      vec2 curl = vVaporPoint.xz * vec2(.078,.076)
        + vVaporPoint.y * vec2(.12,-.16) - vec2(wind * .026, 0.);
      float cloudWeight = inkNoise(curl + 1.);
      float rolls = inkNoise(curl * 2.7 + vec2(cloudWeight * 3.1,-cloudWeight));
      float scallop = cloudWeight * .59 + rolls * .31 + inkNoise(curl * 5.3) * .10;
      vapor = mix(vapor,scallop,moonAir * .91);
    }
    float lobes = smoothstep(.28, .75, vapor);
    vec3 color = mix(mistBase, mistLid, smoothstep(.39, .74, vapor));
    gl_FragColor = vec4(color, reveal * weight * lobes * dissolve);
    #include <colorspace_fragment>
  }
`

export default function SummitVista({ ritual, rally }: {
  ritual: Ritual
  rally: Rally
}) {
  const root = useRef<Group>(null)
  const sky = useRef<Mesh>(null)
  const moonStarted = useRef<number | null>(null)
  const range = useMemo(() => [openingGeometry('nearRange'), openingGeometry('farRange')], [])
  const cloud = useMemo(() => new PlaneGeometry(133, 91, 18, 12), [])
  const dusk = useMemo(() => ({
    blue: new Color('#64819a'), silk: new Color('#c3c9bd'), gold: new Color('#e8bb87'),
    jade: new Color('#73938c'), mist: new Color('#c1cdbb'),
    dayBlue: new Color('#729bb4'), daySilk: new Color('#e0e4d2'), dayGold: new Color('#f0dbad'),
    dayJade: new Color('#86aaa0'), dayMist: new Color('#d4d6b3'),
    lunarJade: new Color('#495b79'), lunarMist: new Color('#a0adbb'),
    cloudDayBase: new Color('#a0b9a8'), cloudDayLid: new Color('#e0debc'),
    cloudNightBase: new Color('#60758d'), cloudNightLid: new Color('#bbc4cd'),
  }), [])
  const reveal = useMemo(() => ({ value: 0 }), [])
  const wind = useMemo(() => ({ value: 0 }), [])
  const lunar = useMemo(() => ({ value: 0 }), [])
  const moonAir = useMemo(() => ({ value: 0 }), [])
  // Share the live uniform object across layers. R3F copies JSX uniform descriptors.
  const skyPaint = useMemo(() => new ShaderMaterial({
    vertexShader: skyVertex, fragmentShader: skyFragment,
    transparent: true, depthWrite: false, side: BackSide, toneMapped: false,
    uniforms: {
      reveal, lunar, moonAir,
      skyShade: { value: new Color('#729bb4') },
      skyPaper: { value: new Color('#e0e4d2') },
      skyGold: { value: new Color('#f0dbad') },
      nightZenith: { value: new Color('#263759') },
      nightHorizon: { value: new Color('#6a83a1') },
      nightPearl: { value: new Color('#deddd2') },
      skyOpening: { value: { x: SUMMIT.aperture.x - 14, y: SUMMIT.aperture.y + 17, z: SUMMIT.aperture.z - 49 } },
    },
  }), [reveal, lunar, moonAir])
  const rockPaint = useMemo(() => new ShaderMaterial({
    vertexShader: rockVertex, fragmentShader: rockFragment, toneMapped: false,
    uniforms: {
      reveal, moonAir,
      jadeMist: { value: new Color('#86aaa0') },
      paperMist: { value: new Color('#d4d6b3') },
    },
  }), [reveal, moonAir])
  const cloudPaint = useMemo(() => [.65, .55].map(weight => new ShaderMaterial({
    vertexShader: cloudVertex, fragmentShader: cloudFragment,
    transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, toneMapped: false,
    uniforms: {
      reveal, wind, moonAir, weight: { value: weight },
      mistBase: { value: new Color('#a0b9a8') },
      mistLid: { value: new Color('#e0debc') },
    },
  })), [reveal, wind, moonAir])

  useEffect(() => () => {
    range.forEach(geometry => geometry.dispose())
    cloud.dispose()
    skyPaint.dispose()
    rockPaint.dispose()
    cloudPaint.forEach(material => material.dispose())
  }, [range, cloud, skyPaint, rockPaint, cloudPaint])

  useFrame(({ camera }, delta) => {
    if (ritual === 'moonrise') moonStarted.current ??= rally.time
    else moonStarted.current = null
    const moonElapsed = moonStarted.current === null ? 0 : rally.time - moonStarted.current
    // The cloud terrace and the summit overlook the same valley. Reveal it as
    // the eye leaves the sheltered gate; only the playable bridge unfolds later.
    const amount = ritual === 'mountain' || ritual === 'unfolding' || ritual === 'summit' ? 1
      : ritual === 'cleared' ? MathUtils.smoothstep(-camera.position.z, 19.5, 24.5)
      : ritual === 'moonrise' ? 1 - MathUtils.smoothstep(moonElapsed, 3.08, 5.15)
      : 0
    const twilight = ritual === 'summit' || ritual === 'moonrise' ? 1 :
      ritual === 'unfolding' ? MathUtils.smoothstep(camera.position.y, 9.5, 17.3) : 0
    const atMoon = ritual === 'summit' || ritual === 'moonrise'
    const nightfall = ritual === 'unfolding' ? .88 * MathUtils.smoothstep(camera.position.y, 11, 16.25) : 0
    moonAir.value = atMoon ? MathUtils.damp(moonAir.value,1,3.7,Math.min(delta,.05)) : nightfall
    skyPaint.uniforms.skyShade.value.copy(dusk.dayBlue).lerp(dusk.blue,twilight)
    skyPaint.uniforms.skyPaper.value.copy(dusk.daySilk).lerp(dusk.silk,twilight)
    skyPaint.uniforms.skyGold.value.copy(dusk.dayGold).lerp(dusk.gold,twilight)
    rockPaint.uniforms.jadeMist.value.copy(dusk.dayJade).lerp(dusk.jade,twilight).lerp(dusk.lunarJade,moonAir.value)
    rockPaint.uniforms.paperMist.value.copy(dusk.dayMist).lerp(dusk.mist,twilight).lerp(dusk.lunarMist,moonAir.value)
    for (const material of cloudPaint) {
      material.uniforms.mistBase.value.copy(dusk.cloudDayBase).lerp(dusk.cloudNightBase,moonAir.value)
      material.uniforms.mistLid.value.copy(dusk.cloudDayLid).lerp(dusk.cloudNightLid,moonAir.value)
    }
    reveal.value = amount
    lunar.value = MathUtils.smoothstep(moonElapsed, .45, 2.6)
    const blend = amount < .99
    if (rockPaint.transparent !== blend) {
      rockPaint.transparent = blend
      rockPaint.depthWrite = !blend
    }
    sky.current?.position.copy(camera.position)
    if (root.current) root.current.visible = amount > .001
    if (amount > .001) wind.value += Math.min(delta, .038)
  })

  return (
    <group ref={root} visible={false} name="Summit ink ranges and cloud sea">
      <mesh ref={sky} material={skyPaint} frustumCulled={false} renderOrder={-8} name="Summit mineral sky">
        <sphereGeometry args={[147, 20, 12]} />
      </mesh>
      {range.map((geometry, index) => (
        <mesh key={index} geometry={geometry} material={rockPaint} renderOrder={index === 0 ? -5 : -6}
          name={index === 0 ? 'Gathered jade peaks' : 'Distant ink ridges'} />
      ))}
      {cloudPaint.map((material, index) => (
        <mesh key={index} position={[1 - index * 13, 3.8 + index * 2.8, -128 - index * 10]} rotation-x={-Math.PI * .5}
          renderOrder={index} geometry={cloud} material={material} name={index === 0 ? 'Lower cloud current' : 'Rising cloud current'} />
      ))}
    </group>
  )
}
