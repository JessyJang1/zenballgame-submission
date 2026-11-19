import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Bone, DoubleSide, Skeleton, type Group, type MeshStandardMaterial, type SkinnedMesh } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FIGURE_BIND, FIGURE_JOINTS } from './assets/rallyMesh'
import { buildRallyRobes } from './assets/rallyRobes'
import { buildRallyHeads } from './assets/rallyHeads'
import { buildRallyRacket } from './assets/rallyRacket'
import { createRallyFigurePose } from './rallyFigurePose'
import { AssetSlot } from './assets/AssetSlots'
import type { Rally } from './rally'

const pigmentThreads: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = 'varying vec3 fabricBind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
    #include <begin_vertex>
    fabricBind = position;
  `)
  shader.fragmentShader = 'varying vec3 fabricBind;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
    #include <color_fragment>
    float cloth = smoothstep(.07,.20,fabricBind.y) * (1. - smoothstep(1.25,1.36,fabricBind.y));
    float lengthwise = sin(fabricBind.x * 93. + fabricBind.z * 49. + .9*sin(fabricBind.y * 12.));
    float crosswise = sin(fabricBind.y * 82. + fabricBind.z * 19.);
    float thread = lengthwise * crosswise * .034 / (1. + 8. * length(fwidth(fabricBind)));
    float pigment = sin(dot(fabricBind,vec3(19.,23.,31.))) * sin(fabricBind.y * 29. - fabricBind.z*34.) * .025;
    diffuseColor.rgb *= 1. + (thread + pigment) * cloth;
  `)
}

export default function InkFigure({ away = false, rally, actorRoot, frameTime }: {
  away?: boolean
  rally: Rally
  actorRoot: RefObject<Group | null>
  frameTime: RefObject<number>
}) {
  const mesh = useRef<SkinnedMesh>(null)
  const racket = useRef<Group>(null)
  const rim = useMemo(() => ({ value: 0 }), [])
  const wood = useRef<MeshStandardMaterial>(null)
  const clothShader = useMemo<MeshStandardMaterial['onBeforeCompile']>(() => (shader, renderer) => {
    pigmentThreads(shader, renderer)
    if (!away) return
    shader.uniforms.shadowRim = rim
    shader.fragmentShader = 'uniform float shadowRim;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>', `
      float edgeLight = smoothstep(.28,.88,1. - abs(dot(normal, normalize(vViewPosition))));
      outgoingLight += vec3(.20,.25,.18) * edgeLight * shadowRim;
      #include <opaque_fragment>
    `)
  }, [away, rim])
  const clothKey = useMemo(() => () => away ? 'ink-robe-rim-v1' : 'visitor-robe-v1', [away])
  const racketGlow = useMemo(() => new Color('#c6a46d'), [])

  const { cloth, gear, rig, pose } = useMemo(() => {
    const parts = [buildRallyRobes(away), buildRallyHeads(away)]
    const cloth = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    const bones = FIGURE_JOINTS.map(name => {
      const bone = new Bone()
      bone.name = name
      bone.position.fromArray(FIGURE_BIND[name])
      return bone
    })
    return { cloth, gear: buildRallyRacket(away), rig: new Skeleton(bones), pose: createRallyFigurePose() }
  }, [away])

  useLayoutEffect(() => {
    if (!mesh.current) return
    mesh.current.updateWorldMatrix(true, true)
    mesh.current.bind(rig)
  }, [rig])
  useEffect(() => () => {
    cloth.dispose(); gear.wood.dispose(); gear.strings.dispose(); rig.dispose()
  }, [cloth, gear, rig])

  useFrame(() => {
    if (!actorRoot.current?.visible || !racket.current) return
    const { ritual, phase } = rally.getStatus()
    const cloudShadow = away && ritual === 'mountain'
    rim.value = cloudShadow ? phase === 'outbound' || phase === 'incoming' ? .80 : .5 : 0
    if (wood.current) wood.current.emissiveIntensity = cloudShadow ? .28 : 0
    pose.sample(rally, actorRoot.current.position, away, frameTime.current)
    FIGURE_JOINTS.forEach((joint,i) => {
      rig.bones[i].position.copy(pose.joint[joint])
      rig.bones[i].quaternion.copy(pose.rotation[joint])
    })
    racket.current.position.copy(pose.joint.rightWrist)
    racket.current.quaternion.copy(pose.racket)
  })
  return <>
    <skinnedMesh ref={mesh} geometry={cloth} castShadow receiveShadow frustumCulled={false}
      name={away ? 'Skinned Ink Shadow' : 'Skinned Visitor'}>
      <meshStandardMaterial side={DoubleSide} vertexColors roughness={.9} onBeforeCompile={clothShader} customProgramCacheKey={clothKey}/>
      {rig.bones.map(bone => <primitive key={bone.name} object={bone} />)}
    </skinnedMesh>
    <group ref={racket} name={away ? 'Shadow woven racket' : 'Visitor woven racket'}>
      <AssetSlot slot="racket">
        <mesh geometry={gear.wood} castShadow>
          <meshStandardMaterial ref={wood} vertexColors roughness={.66} emissive={racketGlow} emissiveIntensity={0}/>
        </mesh>
        <lineSegments geometry={gear.strings}>
          <lineBasicMaterial color={away ? '#ccbc8a' : '#e1c49a'} transparent opacity={.70}/>
        </lineSegments>
      </AssetSlot>
    </group>
  </>
}
