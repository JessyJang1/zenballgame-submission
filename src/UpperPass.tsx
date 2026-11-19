import { useMemo,useEffect,useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Texture } from 'three'
import { openingGeometry } from './assets/openingGeometry'
import { makeCaveStone } from './assets/caveStone'
import { scrollSurfaceY } from './paintingLayout'
import SummitLanternShrine from './SummitLanternShrine'
import type { Ritual } from './rally'

const upperGate=[5.2,15.2,-75.5] as const
export default function UpperPass({atlas,ritual}:{atlas:Texture;ritual:Ritual}){
  const floor=useRef({value:-100})
  const pass=useMemo(()=>openingGeometry('buildPass'),[])
  const trail=useMemo(()=>openingGeometry('cutStoneTrail'),[])
  const pigment=useMemo(()=>{
    const m=makeCaveStone(atlas,'ridge','#e7debf')
    m.vertexColors=true
    const compile=m.onBeforeCompile
    m.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer)
      shader.uniforms.scrollFloor=floor.current
      shader.fragmentShader='uniform float scrollFloor;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
        #include <alphatest_fragment>
        if (cavePoint.y < scrollFloor) discard;
      `)
    }
    m.customProgramCacheKey=()=> 'cave-mineral-ridge-scroll-floor'
    return m
  },[atlas])
  useEffect(()=>()=>{pass.dispose();trail.dispose();pigment.dispose()},[pass,trail,pigment])
  useFrame(()=>{floor.current.value=ritual==='moonrise'||ritual==='ending'?scrollSurfaceY-.015:-100})
  return <group name="Upper limestone pass">
    <mesh geometry={pass} material={pigment} receiveShadow/>
    <mesh geometry={trail} material={pigment} receiveShadow name="Cut trail to the far gate"/>
    <group position={upperGate} rotation-y={-.20}>
      <SummitLanternShrine atlas={atlas} />
    </group>
  </group>
}
