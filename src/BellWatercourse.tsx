import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, MathUtils, type ShaderMaterial } from 'three'
import { buildBellWatercourse } from './bellWatercourseShape'

// A recessed mineral inlay. Its first bend sits under the lip of the lotus pond.
export default function BellWatercourse({ opened, struck, paused }: { opened: boolean; struck: boolean; paused: boolean }) {
  const geometry=useMemo(buildBellWatercourse,[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  const material=useRef<ShaderMaterial>(null)
  const uniforms=useMemo(()=>({flow:{value:-.15},resonance:{value:0}}),[])
  useFrame((_,dt)=>{
    if (!material.current || paused) return
    const {flow,resonance}=material.current.uniforms
    const elapsed=Math.min(dt,.05)
    flow.value=opened?Math.min(1.8,flow.value+elapsed*1.55):-.15
    resonance.value=opened ? MathUtils.damp(resonance.value,struck?0:1,8,elapsed) : 0
  })
  return <mesh geometry={geometry} name="Lotus spillway to the bell">
    <shaderMaterial ref={material} uniforms={uniforms} side={DoubleSide}
      vertexShader="varying vec2 stream;void main(){stream=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
      fragmentShader={`varying vec2 stream;uniform float flow;uniform float resonance;
        void main(){
          if(flow<0.)discard;
          float side=abs(stream.y);
          float bank=smoothstep(.65,.96,side);
          float wet=smoothstep(-.025,.025,flow-stream.x);
          float tail=flow-stream.x;
          float edgeDistance=tail*8.5;
          float crest=exp(-edgeDistance*edgeDistance);
          float ripples=pow(.5+.5*cos(tail*86.+side*3.4),5.)*wet*(1.-smoothstep(.025,.36,tail));
          vec3 water=mix(vec3(.025,.050,.039),vec3(.08,.23,.18),wet);
          water+=(crest*.93+ripples*.18)*vec3(.71,.58,.29)*(1.-side*.5);
          vec3 stone=mix(vec3(.13,.105,.062),vec3(.35,.25,.12),wet);
          if(stream.x>1.04){
            float light=wet*resonance*(1.-side*.68);
            gl_FragColor=vec4(mix(vec3(.16,.115,.053),vec3(.91,.65,.29),light),1.);
          }else{
            gl_FragColor=vec4(mix(water,stone,bank),1.);
          }
          #include <colorspace_fragment>
        }`}/>
  </mesh>
}
