import StoneCourtGroundwork, { makeStratifiedCourtStone } from './StoneCourtGroundwork'
import CourtMountainBackdrop from './CourtMountainBackdrop'
import CourtCloister from './CourtCloister'
import CourtExcavation, { courtGalleryWings } from './CourtExcavation'
import PassDaylight from "./PassDaylight"
import UpperPass from "./UpperPass"
import GalleryFittings from "./GalleryFittings"
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Ritual } from './rally'
import { useSceneTexture } from './assets/useSceneTexture'
import { DoubleSide, Object3D, PerspectiveCamera, Matrix4, SRGBColorSpace } from 'three'
import { makeCaveStone } from './assets/caveStone'

import { openingGeometry } from './assets/openingGeometry'

export default function GrottoHall({ritual}:{ritual:Ritual}){
  const atlas=useSceneTexture(import.meta.env.BASE_URL+'assets/art/stone-prologue-card.png')
  const fresco=useSceneTexture(import.meta.env.BASE_URL+'assets/art/court-fresco.webp')
  fresco.colorSpace=SRGBColorSpace
  // Bake a fixed projector into world space. The pigment always follows the
  // rock under camera travel; it is sampled only on the western vault.
  const projector=useMemo(()=>{
    const lens=new PerspectiveCamera(33,16/9,.1,250)
    lens.position.set(5.60,5.78,23.54);lens.lookAt(-2.94,1.93,-6);lens.updateMatrixWorld()
    return new Matrix4().multiplyMatrices(lens.projectionMatrix,lens.matrixWorldInverse)
  },[])
  const hall=useMemo(()=>openingGeometry('roof'),[]), gallery=useMemo(()=>openingGeometry('arcade'),[]), blocks=useMemo(()=>openingGeometry('archStones'),[])
  const cut=useRef({value:0})
  const makeStone=(revealing: boolean)=>{
    const material=makeCaveStone(atlas,'vault','#657169')
    const compile=material.onBeforeCompile
    material.onBeforeCompile=function(shader,renderer){
      compile.call(this,shader,renderer)
      if (revealing) shader.uniforms.scrollCut=cut.current
      shader.uniforms.frescoMap={value:fresco}
      shader.uniforms.paintProjector={value:projector}
      shader.vertexShader='varying vec4 frescoProjection; uniform mat4 paintProjector;\n'+shader.vertexShader
        .replace('#include <project_vertex>', '#include <project_vertex>\n frescoProjection=paintProjector*vec4(cavePoint,1.);')
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        vec4 projected=frescoProjection;
        vec2 film=projected.xy/projected.w*.5+.5;
        vec2 uvPaint=(film-vec2(-.012,.635))/vec2(.397,.30);
        vec2 lookup=clamp(uvPaint,0.,1.);
        vec2 du=dFdx(lookup), dv=dFdy(lookup);
        vec4 ink=vec4(0.);
        if(cavePoint.x < -2. && projected.w >= .01 && min(uvPaint.x,uvPaint.y)>=0. && max(uvPaint.x,uvPaint.y)<=1.){
          ink=textureGrad(frescoMap,lookup,du,dv);
        }
        float mask=ink.a*(1.-smoothstep(-4.,-2.,cavePoint.x))*step(.01,projected.w)
          *step(0.,min(uvPaint.x,uvPaint.y))*step(max(uvPaint.x,uvPaint.y),1.);
        diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb*(1.15+.4*textureGrain),mask*.94);
      `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        totalEmissiveRadiance+=ink.rgb*mask*.25;`)
      shader.fragmentShader='uniform sampler2D frescoMap; varying vec4 frescoProjection;\n'+shader.fragmentShader
      if (revealing) shader.fragmentShader='uniform float scrollCut;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
        #include <alphatest_fragment>
        float edge=cavePoint.x+.16*cavePoint.y+.53*sin(cavePoint.z*.69);
        if(edge>mix(28.,-12.6,scrollCut))discard;
      `)
    }
    material.customProgramCacheKey=()=> revealing ? 'grotto-fresco-reveal-v2' : 'grotto-fresco-opaque-v2'
    material.side=DoubleSide
    return material
  }
  const [solid, reveal]=useMemo(()=>[makeStone(false),makeStone(true)],[atlas,fresco,projector])
  const stone=ritual==='moonrise' || ritual==='ending' ? reveal : solid
  useFrame((_,delta)=>{
    cut.current.value=ritual==='ending'?1:ritual==='moonrise'?Math.min(1,cut.current.value+Math.min(delta,.05)/5.2):0
  })
  const carved=useMemo(()=>makeStratifiedCourtStone('#484e45'),[])
  const dressed=useMemo(()=>makeStratifiedCourtStone('#dedbc9',true),[])
  const sunPatch=useMemo(()=>{const target=new Object3D();target.position.set(1.8,.08,1.70);return target},[])
  const galleryBounce=useMemo(()=>{
    const target=new Object3D();target.position.set(-10.7,2.5,-4.1);return target
  },[])
  useEffect(()=>()=>{hall.dispose();gallery.dispose();blocks.dispose();solid.dispose();reveal.dispose();carved.dispose();dressed.dispose()},[hall,gallery,blocks,solid,reveal,carved,dressed])
  return <group name="Skylit mountain hall">
    <CourtMountainBackdrop ritual={ritual}/>
    <UpperPass atlas={atlas} ritual={ritual}/>
    <PassDaylight/>
    <primitive object={sunPatch}/>
    <primitive object={galleryBounce}/>
    <spotLight position={[-2.2,8.6,4.1]} color="#ffdfaa" target={galleryBounce}
      intensity={380} angle={.49} penumbra={.78} distance={28}/>
    <spotLight position={[-7.8,16.6,-12.8]} target={sunPatch} color="#ffdec0" intensity={2260} angle={.36} penumbra={.82} distance={42}/>
    <directionalLight position={[3,9,16]} color="#ffdfb0" intensity={.66}/>
    <mesh geometry={hall} material={stone} receiveShadow/>
    <StoneCourtGroundwork/>
    <CourtExcavation atlas={atlas} caveWall={stone} vista={ritual==='lotus'||ritual==='bell'||ritual==='passage'||ritual==='cleared'}/>
    {courtGalleryWings.map(({side,x,y,z})=><group key={side} position={[x,y,z]} rotation-y={side*Math.PI/2} scale={[1,.82,1]}>
      <CourtCloister/>
      <GalleryFittings/>
      <mesh geometry={blocks} material={dressed} receiveShadow/>
      <mesh geometry={gallery} material={carved} castShadow receiveShadow/>
    </group>)}
  </group>
}
