import { useEffect, useMemo, type RefObject } from 'react'
import { DoubleSide, MeshBasicMaterial, type Vector3, type Group, type Texture } from 'three'

import { openingGeometry } from './assets/openingGeometry'

export default function ThresholdVault({atlas,rock,wake,impact,wave,folioView=false}:{atlas:Texture;rock:RefObject<Group | null>;wake:{value:number};impact:Vector3;wave:{value:number};folioView?:boolean}) {
  const geometry=useMemo(()=>openingGeometry('sculptThreshold'),[])
  const pigment=useMemo(()=>{
    const material=new MeshBasicMaterial({map:atlas,side:DoubleSide})
    material.onBeforeCompile=shader=>{
      shader.uniforms.impactSite={value:impact}
      shader.uniforms.waveRadius=wave
      shader.uniforms.stoneWake=wake
      shader.vertexShader=`attribute float facade;attribute float recess;
        varying vec3 rockPosition;varying vec3 rockNormal;varying float painted;varying float caveDepth;\n`+shader.vertexShader.replace(
          '#include <begin_vertex>',`#include <begin_vertex>
          rockPosition=position;rockNormal=normal;painted=facade;caveDepth=recess;`)
      shader.fragmentShader=`uniform float stoneWake; uniform vec3 impactSite; uniform float waveRadius;
        varying vec3 rockPosition;varying vec3 rockNormal;varying float painted;varying float caveDepth;\n`+shader.fragmentShader.replace(
        '#include <map_pars_fragment>',`#include <map_pars_fragment>
        float stoneNoise(vec2 p){
          vec2 cell=floor(p), f=fract(p);f=f*f*(3.-2.*f);
          vec4 n=vec4(dot(cell,vec2(27.13,79.91)))+vec4(0.,27.13,79.91,107.04);
          vec4 h=fract(sin(n)*43817.31);
          return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
        }
        vec3 mineralSwatch(vec2 q){
          vec2 uv=1.-abs(fract(q*.5)*2.-1.);
          return texture2D(map,vec2(.426,.829)+vec2(.071,.107)*uv).rgb;
        }`).replace('#include <map_fragment>',`
        vec3 p=rockPosition, n=normalize(rockNormal);
        ${folioView ? `
          float arch = 1. - smoothstep(2.35, 5.2, abs(p.x - .35));
          float section = mix(7.4, 2.85, arch) + .18 * sin(p.x * 2.4 + p.z);
          if (p.y > section) discard;
        ` : ''}
        vec3 weight=pow(abs(n),vec3(4.));
        weight/=max(dot(weight,vec3(1.)),.001);
        vec3 q=p*.73;
        vec3 stoneTexel=weight.x*mineralSwatch(q.yz)+weight.y*mineralSwatch(q.xz)+weight.z*mineralSwatch(q.xy);
        float mineral=clamp(dot(stoneTexel,vec3(.35,.52,.13))*2.2,0.,1.);
        float grain=fract(sin(dot(floor(p*145.),vec3(.73,2.31,4.18)))*731.53);
        float strata=sin(p.y*5.7+sin(p.z*.81+p.x*.63)*2.);
        float sunlight=dot(n,normalize(vec3(-.48,.72,-.44)));
        float daylight=.65+.55*smoothstep(-.5,.95,sunlight);
        daylight*=1.-.22*sin(clamp(caveDepth/12.4,0.,1.)*3.14159);
        vec3 cave=mix(vec3(.045,.079,.061),vec3(.29,.193,.094),mineral*.79);
        cave*=daylight*(.82+mineral*.31+grain*.12+strata*.033);
        // Match the hue of the sunlit outer rock, while keeping the grain in
        // its world position. Luminance now falls with depth instead of atlas rows.
        float right=smoothstep(2.15,4.45,p.x);
        // Both faces share a folded rock coordinate: X increases across the
        // facade and Z decreases into the throat. The coordinate is continuous
        // through the rounded lip, independent of the painted UV island.
        vec2 bedding=vec2(p.x+p.z*.86+p.y*.19,p.y-p.z*.16);
        float fault=stoneNoise(bedding*.34);
        vec2 field=bedding*.43+vec2(.22*fault,.13*stoneNoise(bedding*.87));
        vec2 tile=1.-abs(fract(field*.5)*2.-1.);
        // Bare blue-green bedrock above the figure on the approved card.
        vec3 rock=texture2D(map,vec2(.621,.823)+tile*vec2(.103,.074)).rgb;
        vec2 detailUv=1.-abs(fract((bedding*.74+fault)*.5)*2.-1.);
        vec3 detail=mineralSwatch(detailUv);
        float sediment=stoneNoise(vec2(bedding.x*.52,bedding.y*1.75)+fault*1.8);
        float fracture=exp(-abs(sediment-.48)*39.);
        float worn=smoothstep(.30,.69,stoneNoise(bedding*.64));
        float fleck=dot(rock,vec3(.30,.55,.15));
        vec3 bed=mix(vec3(.066,.083,.063),vec3(.375,.285,.165),
          smoothstep(.017,.28,fleck*.63+mineral*.22+dot(detail,vec3(.12,.24,.08))));
        bed*=.86+.24*stoneNoise(bedding*13.);
        // Resolvable chipped laminae share the fold coordinate across the lip.
        float chip=stoneNoise(bedding*24.);
        float course=bedding.y*3.6+.88*stoneNoise(bedding*2.7)+3.2*fault+.62*sin(bedding.y*2.4+fault);
        float sidewall=smoothstep(.05,1.55,caveDepth);
        float parting=abs(fract(course+.07*chip)-.5);
        float resolved=1.-smoothstep(.045,.22,fwidth(course));
        float groove=1.-smoothstep(.018,.082,parting);
        float ledge=smoothstep(.041,.09,parting)*(1.-smoothstep(.09,.17,parting));
        float broken=smoothstep(.34,.74,stoneNoise(bedding*3.8));
        bed*=1.+sidewall*resolved*broken*(.17*ledge-.31*groove);
        float grit=stoneNoise(bedding*87.);
        bed*=1.+sidewall*(grit-.5)*.36*(1.-smoothstep(.12,.62,fwidth(bedding.y)*87.));
        bed=mix(bed,vec3(.35,.215,.092),fracture*worn*.15);
        // Broad ledges interrupt grazing light; sheltered strata lose it with depth.
        float exposed=smoothstep(-.42,.86,sunlight+(sediment-.5)*.73);
        float rimLight=exposed*(.32+.68*worn)*exp(-.44*caveDepth);
        float skylight=.69+.32*exposed;
        bed+=vec3(.11,.068,.027)*rimLight;
        skylight*=1.-.19*sin(clamp(caveDepth/12.4,0.,1.)*3.14159);
        cave=mix(cave,bed*skylight,right);
        vec3 mural=texture2D(map,vMapUv).rgb;
        float imageX=vMapUv.x*1672.;
        float imageY=(1.-vMapUv.y)*941.;
        // The artwork also contains sky and water immediately beyond the inner silhouette.
        // Exclude those pixels from the turn rather than stretching them along the wall.
        float bareEdge=929.+15.*smoothstep(350.,470.,imageY)+27.*smoothstep(625.,707.,imageY);
        float rockOnly=smoothstep(bareEdge,bareEdge+43.,imageX);
        // The card has baked-in sun on the bare shoulder bordering the mural.
        // Recover the rock under that highlight before applying the 3D light.
        float shoulder=right*(1.-smoothstep(bareEdge+76.,bareEdge+153.,imageX+(fault-.5)*25.));
        mural=mix(mural,bed*skylight,shoulder*.98);
        float decal=mix(1.,rockOnly*(1.-smoothstep(0.,2.8,caveDepth)),right);
        float awake=(1.-.67*right)*exp(-abs(p.x-1.)*.22)*exp(-abs(p.z-40.)*.10);
        float front=distance(p,impactSite)-waveRadius;
        float echo=step(0.,waveRadius)*exp(-front*front*2.4)*exp(-max(waveRadius,0.)*.095);
        diffuseColor.rgb*=mix(cave,mural*(.84+.22*daylight),smoothstep(.0,1.,painted)*decal)+vec3(.34,.185,.066)*awake*stoneWake+vec3(.84,.44,.105)*echo*(.24+.76*mineral);
        `)
    }
    material.customProgramCacheKey = () => folioView ? 'threshold-rock-section' : 'threshold-rock'
    return material
  },[atlas,wake,impact,wave,folioView])
  useEffect(()=>()=>{geometry.dispose();pigment.dispose()},[geometry,pigment])
  return <group ref={rock} name="Continuous bedrock vault">
    <mesh geometry={geometry} material={pigment}/>
  </group>
}
