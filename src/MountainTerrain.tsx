import { useEffect, useMemo } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferAttribute, BufferGeometry, MeshStandardMaterial, SRGBColorSpace, Vector4 } from 'three'
import { worldTerrain } from './terrainSurface'

export default function MountainTerrain() {
  const source=useSceneTexture(import.meta.env.BASE_URL+'assets/art/worldview-card.png')
  const faceTexture=useSceneTexture(import.meta.env.BASE_URL+'assets/art/escarpment-mineral.jpg')
  faceTexture.colorSpace=SRGBColorSpace
  source.colorSpace=SRGBColorSpace
  const geometry=useMemo(()=>{
    const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(worldTerrain.positions,3));g.setAttribute('uv',new BufferAttribute(worldTerrain.uv,2));g.setIndex(new BufferAttribute(worldTerrain.indices,1));g.computeVertexNormals();return g
  },[])
  const material=useMemo(()=>{
    const m=new MeshStandardMaterial({map:source,roughness:1,metalness:0})
    m.onBeforeCompile=shader=>{
      // Sample only the reference card's mineral-pigment swatches. No face or painted scene is remapped.
      shader.uniforms.escarpment={value:faceTexture}
      shader.uniforms.greenChip={value:new Vector4(50/1448,(1086-1020)/1086,60/1448,40/1086)}
      shader.uniforms.goldChip={value:new Vector4(310/1448,(1086-1020)/1086,60/1448,40/1086)}
      shader.vertexShader='varying vec3 mineralPosition; varying vec3 mineralNormal;\n'+shader.vertexShader
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmineralPosition=position; mineralNormal=normal;')
      shader.fragmentShader=`varying vec3 mineralPosition; varying vec3 mineralNormal;
        uniform vec4 greenChip; uniform vec4 goldChip; uniform sampler2D escarpment;
        `+shader.fragmentShader
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nvec3 chip(vec2 uv,vec4 region){return texture2D(map,region.xy+fract(uv)*region.zw).rgb;}')
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        vec3 weights=pow(abs(normalize(mineralNormal)),vec3(4.0));weights/=max(dot(weights,vec3(1.0)),.0001);
        vec3 p=mineralPosition*.63;
        vec3 green=chip(p.yz,greenChip)*weights.x+chip(p.xz,greenChip)*weights.y+chip(p.xy,greenChip)*weights.z;
        vec3 gold=chip(p.yz,goldChip)*weights.x+chip(p.xz,goldChip)*weights.y+chip(p.xy,goldChip)*weights.z;
        float bank=smoothstep(5.0,10.0,mineralPosition.x+1.5);
        float peak=1.0-smoothstep(13.0,24.0,abs(mineralPosition.z+34.0));
        float grain=clamp((dot(green,vec3(.299,.587,.114))-.075)*2.0,-.08,.09);
        vec3 pigment=mix(vec3(.035,.078,.062),vec3(.41,.265,.105),bank*peak*.60);
        vec3 n=normalize(mineralNormal);
        float rock=smoothstep(1.0,4.0,mineralPosition.y)*smoothstep(0.08,0.48,1.0-n.y);
        float flex=.46*sin(p.z*1.5+p.x*.6)+.19*sin(p.x*3.3-p.z*.9);
        float bedding=mineralPosition.y*4.1+p.z*.84+p.x*.53+flex;
        float seam=1.0-smoothstep(.07,.38,abs(sin(bedding)));
        float brow=smoothstep(.57,.94,sin(bedding-.45))*smoothstep(-.4,.65,n.x*.41+n.z*.8);
        float face=clamp(dot(n,normalize(vec3(-.68,.34,.54))),0.0,1.0);
        vec3 cliff=mix(vec3(.029,.067,.065),vec3(.134,.177,.139),face);
        cliff=mix(cliff,vec3(.34,.217,.101)*(.69+.51*face),bank*peak*.74);
        float cleavage=p.x*2.9+p.z*1.8-mineralPosition.y*.71+flex;
        float flute=abs(sin(cleavage+.57*sin(cleavage*1.76+p.y*.48)));
        float outcrop=smoothstep(-.52,.7,sin(p.z*.72+p.x*1.26+p.y*.52));
        cliff*=.88+.17*flute-.14*seam*outcrop;
        cliff+=vec3(.027,.030,.019)*flute*face*outcrop;
        cliff+=vec3(.058,.041,.02)*brow+gold*.031*face;
        vec2 cragUV=vec2(p.x*.17+p.z*.108,p.y*.26+p.x*.055);
        vec2 uvRock=1.-abs(fract(cragUV)*2.-1.);
        vec3 deposit=texture2D(escarpment,uvRock).rgb;
        float fracture=dot(deposit,vec3(.25,.62,.13));
        vec3 exposed=mix(vec3(.065,.112,.095),vec3(.53,.405,.225),smoothstep(.12,.48,fracture)*(.55+.45*bank));
        cliff=mix(cliff,exposed,.71);
        diffuseColor.rgb*=mix(pigment,cliff,rock)*(1.0+grain);
      `)
    }
    m.customProgramCacheKey=()=> 'original-mineral-swatches-triplanar-strata-v2'
    return m
  },[source,faceTexture])
  useEffect(()=>()=>{geometry.dispose();material.dispose()},[geometry,material])
  return <mesh castShadow receiveShadow geometry={geometry} name="Continuous mountain terrain"><primitive object={material} attach="material"/></mesh>
}
