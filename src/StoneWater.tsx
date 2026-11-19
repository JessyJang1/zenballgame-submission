import { useEffect, useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Color, Matrix4, Shape, ShapeGeometry, SphereGeometry, ShaderMaterial } from 'three'

import { Reflector } from 'three/addons/objects/Reflector.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const approachLeaves = Array.from({ length: 26 }, (_, i) => {
  const spread = Math.sin(i * 96.2) ** 2
  return { x: (i % 2 === 0 ? -1 : 1) * (2.1 + spread * 7), z: 15 + ((i * 13.63) % 43),
    size: .24 + spread * .49, angle: i * 2.15, flower: i % 5 === 0 }
})

const leaves=approachLeaves.concat(Array.from({length:42},(_,i)=>{
  const t=Math.sin(i*12.97)**2
  return {x:(i%2?1:-1)*(8.45+1.9*t),z:-11+(i*7.37)%23,size:.15+.30*t,angle:i*2.4,flower:i%7===0}
}))

export default function StoneWater({ progress }: { progress: RefObject<number> }) {
  const water = useMemo(() => {
    const banks = new Shape()
    banks.moveTo(-24,-60)
    banks.lineTo(24,-60)
    banks.lineTo(23,-39)
    banks.lineTo(33,-24)
    banks.lineTo(37,19)
    banks.lineTo(8.22,19)
    banks.lineTo(8.18,-12.7)
    banks.lineTo(-8.18,-12.7)
    banks.lineTo(-8.22,19)
    banks.lineTo(-37,19)
    banks.lineTo(-33,-24)
    banks.lineTo(-23,-39)
    banks.closePath()
    const shader = {
      name: 'Cave pool reflection',
      uniforms: {
        color: { value: new Color('#325d50') },
        tDiffuse: { value: null },
        textureMatrix: { value: new Matrix4() },
        wake: { value: 0 },
        flowTime: { value: 0 },
      },
      vertexShader: `uniform mat4 textureMatrix;
        varying vec3 ground;
        varying vec4 mirrored;
        void main() {
          vec4 p=modelMatrix*vec4(position,1.);
          ground=p.xyz;
          mirrored=textureMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*viewMatrix*p;
        }`,
      fragmentShader: `varying vec3 ground;
        varying vec4 mirrored;
        uniform sampler2D tDiffuse;
        uniform vec3 color;
        uniform float wake;
        uniform float flowTime;
        float lampGlint(vec2 p,vec2 lamp,float streak){
          vec2 d=p-lamp;
          float ribbon=exp(-abs(d.x-.11*sin(d.y*17.))*7.6);
          float reflection=smoothstep(-.25,.18,d.y)*exp(-max(d.y,0.)*.84);
          return ribbon*reflection*streak;
        }
        void main(){
          vec2 p=ground.xz;
          float longWave=sin(p.y*8.1+sin(p.x*.86+p.y*.63)*2.1-wake*17.-flowTime*.91);
          float fineWave=sin(p.y*21.+sin(p.x*2.3+p.y*.74)*2.1+wake*12.+flowTime*1.48);
          vec2 coord=mirrored.xy/mirrored.w+vec2(longWave,fineWave)*vec2(.0022,.0032);
          vec3 reflected=texture2D(tDiffuse,clamp(coord,.002,.998)).rgb;
          float angle=abs(normalize(cameraPosition-ground).y);
          float fresnel=mix(.26,.71,pow(1.-angle,2.1));
          float bed=sin(p.x*1.13+sin(p.y*2.3)*1.3)*sin(p.y*.81+cos(p.x*2.35));
          float sheen=pow(max(0.,fineWave*longWave),5.)*exp(-abs(p.x-.8)*.28);
          float waterline=(1.-smoothstep(0.,.18,abs(p.y-12.76)))*.09;
          vec3 shade=mix(color*(.65+.16*bed),reflected*vec3(.73,.89,.83),fresnel);
          float flicker=pow(.5+.5*fineWave,6.)*(.51+.49*longWave);
          float lamps=lampGlint(p,vec2(-8.65,-1.25),flicker)+lampGlint(p,vec2(8.67,7.72),flicker);
          shade+=vec3(.74,.40,.13)*(sheen*.21+waterline+lamps*.38);
          gl_FragColor=vec4(shade,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }
    const pool = new Reflector(new ShapeGeometry(banks), {
      color: '#315648', textureWidth: 480, textureHeight: 270, multisample: 0,
      clipBias: .0009, shader,
    })
    pool.name = 'Reflecting pool: threshold to court'
    pool.rotation.x = -Math.PI/2
    pool.position.y = .04
    return pool
  }, [])
  useEffect(() => () => { water.geometry.dispose(); water.dispose() }, [water])
  const foliage = useMemo(() => {
    const pads = leaves.map(({x,z,size,angle}) => new CircleGeometry(1,14,.1,Math.PI*1.83)
      .rotateZ(angle).rotateX(-Math.PI/2).scale(size,size,size).translate(x,.064,z))
    const petals = leaves.filter(leaf => leaf.flower).flatMap(({x,z,size}) =>
      Array.from({length: 6}, (_, i) => new SphereGeometry(1,8,6)
        .scale(.17,.35,.095).rotateX(-.67).translate(0,.27,.29)
        .applyMatrix4(new Matrix4().makeRotationY(i*Math.PI/3))
        .scale(size,size,size).translate(x,.064,z)))
    const geometry = { pads: mergeGeometries(pads), petals: mergeGeometries(petals) }
    for (const source of [...pads, ...petals]) source.dispose()
    return geometry
  }, [])
  useEffect(() => () => { foliage.pads.dispose(); foliage.petals.dispose() }, [foliage])
  useFrame((_,delta) => {
    if (!(water.material instanceof ShaderMaterial)) return
    water.material.uniforms.wake.value=progress.current
    water.material.uniforms.flowTime.value+=Math.min(delta,.07)
  })
  return <>
    <primitive object={water}/>
    <mesh geometry={foliage.pads}><meshStandardMaterial color="#526c48" roughness={.48}/></mesh>
    <mesh geometry={foliage.petals}><meshStandardMaterial color="#d5a999" roughness={.84}/></mesh>
  </>
}
