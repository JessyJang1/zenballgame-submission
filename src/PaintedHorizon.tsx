import { useMemo, useRef, type RefObject } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { useFrame } from '@react-three/fiber'
import { MathUtils, SRGBColorSpace, type Mesh, type ShaderMaterial } from 'three'
import type { Entry } from './paintingLayout'
import type { Ritual } from './rally'
// Explicit distant 2.5D scenery. Never used as terrain, a gate, or a traversable space.
export default function PaintedHorizon({ritual,entry,entryProgress,foldProgress}:{ritual:Ritual;entry:Entry;entryProgress:RefObject<number>;foldProgress:RefObject<number>}) {
  const map=useSceneTexture(import.meta.env.BASE_URL+'assets/art/shan-men.png')
  map.colorSpace=SRGBColorSpace
  const material=useRef<ShaderMaterial>(null)
  const painting=useRef<Mesh>(null)
  const uniforms=useMemo(()=>({original:{value:map},opacity:{value:.38}}),[map])
  useFrame(()=>{
    const keepPainting = ritual === 'unfolding' ? 1 - MathUtils.smoothstep(foldProgress.current, .27, .69)
      : ritual === 'mountain' ? 1 : 0
    if (painting.current) painting.current.visible = keepPainting > .001
    if(material.current)material.current.uniforms.opacity.value=.38*keepPainting*(entry==='playing'?1:MathUtils.smoothstep(entryProgress.current,.72,1))
  })
  return <mesh ref={painting} position={[0,-28,-102]} name="Distant original mountain painting">
    <planeGeometry args={[110,98]}/>
    <shaderMaterial ref={material} transparent depthWrite={false} toneMapped={false} uniforms={uniforms}
      vertexShader="varying vec2 imageUV;void main(){imageUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
      fragmentShader={`uniform sampler2D original;uniform float opacity;varying vec2 imageUV;
        void main(){vec2 uv=vec2((16.0+imageUV.x*544.0)/576.0,1.0-(14.0+(1.0-imageUV.y)*490.0)/762.0);
        vec3 color=texture2D(original,uv).rgb;
        float edge=smoothstep(0.0,.10,imageUV.x)*smoothstep(0.0,.10,1.0-imageUV.x)*smoothstep(0.0,.24,imageUV.y)*smoothstep(0.0,.16,1.0-imageUV.y);
        gl_FragColor=vec4(color,opacity*edge);
        #include <colorspace_fragment>
        }`}/>
  </mesh>
}
