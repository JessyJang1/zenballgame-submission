import { useEffect, useMemo, useRef } from 'react'
import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Shape, Vector2, type Mesh, type MeshBasicMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeStratifiedCourtStone } from './StoneCourtGroundwork'
import { LOTUS_BASIN_LOCAL as edge } from './gardenLayout'

const leaves=[{x:.64,z:.72,r:.35},{x:-.82,z:.48,r:.39},{x:.47,z:-.96,r:.37}]

function buildRim() {
  const center=new Vector2(0,0)
  const pieces=edge.map(([x,z],i)=>{
    const start=new Vector2(x,z)
    const end=new Vector2(...edge[(i+1)%edge.length])
    const length=start.distanceTo(end)
    const stones=Math.ceil(length/.57)
    const positions:number[] = [],indices:number[] = []
    for(let j=0;j<stones;j++){
      const a=start.clone().lerp(end,(j+.045)/stones)
      const b=start.clone().lerp(end,(j+.955)/stones)
      const width=.15+.038*Math.sin(i*6+j*2.3)
      const height=.07+.022*Math.sin(i*3+j*1.5)
      const outer=(v:Vector2)=>(v.clone().sub(center).normalize().multiplyScalar(width).add(v))
      const corners=[a,b,outer(b),outer(a)]
      const offset=positions.length/3
      const middle=a.clone().lerp(b,.5)
      for(let row=0;row<2;row++)corners.forEach((p)=>{
        const v=row ? p.clone().lerp(middle,.085) : p
        positions.push(v.x,row ? height : .009,v.y)
      })
      indices.push(offset+4,offset+6,offset+5,offset+4,offset+7,offset+6)
      for(let k=0;k<4;k++){
        const v=offset+k,next=offset+(k+1)%4
        indices.push(v,next,v+4,next,next+4,v+4)
      }
    }
    const geometry=new BufferGeometry()
    geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  })
  const result=mergeGeometries(pieces)
  pieces.forEach(geometry=>geometry.dispose())
  return result
}

export default function LotusPond({opened}:{opened:boolean}) {
  const material=useMemo(()=>{
    const m=makeStratifiedCourtStone('#96886e')
    m.side=DoubleSide
    return m
  },[])
  const rim=useMemo(buildRim,[])
  const shape=useMemo(()=>{const s=new Shape();edge.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return s},[])
  const leaf=useMemo(()=>{const s=new Shape();s.moveTo(0,0);s.absarc(0,0,1,.2,Math.PI*2-.2,false);s.lineTo(0,0);return s},[])
  useEffect(()=>()=>{rim.dispose();material.dispose()},[rim,material])
  const ripple=useRef<Mesh>(null),elapsed=useRef(0)
  const waterUniforms=useMemo(()=>({time:{value:0},focus:{value:1}}),[])
  useFrame((_,delta)=>{
    waterUniforms.time.value+=Math.min(delta,.05)
    waterUniforms.focus.value=opened ? 0 : 1
    const ring=ripple.current
    if(!ring)return
    elapsed.current=opened ? Math.min(elapsed.current+Math.min(delta,.05),1.28) : 0
    const phase=elapsed.current/1.28
    ring.visible=opened&&phase<1
    ring.scale.setScalar(.64+phase*.31)
    const fade=ring.material as MeshBasicMaterial
    fade.opacity=(1-phase)*.42
  })
  return <group name="Shallow lotus pond">
    <mesh rotation-x={-Math.PI/2} position-y={-.075}><shapeGeometry args={[shape]}/>
      <shaderMaterial uniforms={waterUniforms}
        vertexShader={`varying vec2 pond;void main(){pond=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec2 pond;uniform float time;uniform float focus;void main(){
          float wave=sin(pond.y*16.+sin(pond.x*5.)*1.5-time*1.8);
          float ripple=pow(max(0.,wave*sin(pond.x*13.+pond.y*5.4)),6.);
          float light=exp(-dot((pond-vec2(.35,-.1))*vec2(.50,.82),(pond-vec2(.35,-.1))*vec2(.50,.82)));
          vec3 pigment=mix(vec3(.012,.056,.053),vec3(.105,.235,.190),light*.88);
          float focalWash=exp(-dot(pond*vec2(1.05,.88),pond*vec2(1.05,.88)));
          vec3 reflectedPetals=vec3(.13,.105,.043)*focalWash*focus;
          gl_FragColor=vec4(pigment+reflectedPetals+vec3(.24,.18,.079)*ripple*.23,1.);
          #include <colorspace_fragment>
        }`}/>
    </mesh>
    <mesh material={material} geometry={rim} receiveShadow/>
    {leaves.map(({x,z,r},i)=><group key={x} position={[x,.036,z]} rotation-y={i*.72}>
      <mesh rotation-x={-Math.PI/2} scale={r}>
        <shapeGeometry args={[leaf,32]}/>
        <meshStandardMaterial color={i%2?'#566747':'#4e684d'} roughness={.76}/>
      </mesh>
      <Line points={Array.from({length:7},(_,j)=>{
        const a=.3+j*.84
        return [[0,.002,0],[Math.cos(a)*r*.9,.002,Math.sin(a)*r*.9]] as [number,number,number][]
      }).flat()} segments color="#a68c56" lineWidth={.65} transparent opacity={.58}/>
    </group>)}
    <mesh ref={ripple} rotation-x={-Math.PI/2} position-y={.026} visible={false}>
      <ringGeometry args={[1.08,1.11,44]}/>
      <meshBasicMaterial color="#cde7bd" transparent depthWrite={false}/>
    </mesh>
  </group>
}
