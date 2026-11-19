import { MeshStandardMaterial, Texture, Vector4 } from 'three'
import { folioWorldToMap } from '../finaleLayout'

export function makeCaveStone(atlas: Texture, surface: 'ridge' | 'road' | 'court' | 'bank' | 'vault', tint: string, paving?: Texture) {
  const material = new MeshStandardMaterial({ map: atlas, color: tint, roughness: .88 })
  const scale = { ridge: .28, road: .92, court: .77, bank: .51, vault: .67 }[surface]
  material.onBeforeCompile = shader => {
    if(paving)shader.uniforms.flagstone={value:paving}
    shader.uniforms.folioWorldToMap = folioWorldToMap
    // A bare mineral patch from the approved rock crown, without lettering or figures.
    shader.uniforms.stonePatch = { value: new Vector4(714/1672, 1-161/941, 118/1672, 101/941) }
    shader.vertexShader = `uniform mat4 folioWorldToMap; varying vec3 cavePoint; varying vec3 caveNormal;\n` + shader.vertexShader.replace(
      '#include <begin_vertex>', `#include <begin_vertex>
      cavePoint = (folioWorldToMap * (modelMatrix * vec4(position, 1.))).xyz;
      caveNormal = normalize(mat3(folioWorldToMap) * (mat3(modelMatrix) * normal));
    `)
    shader.fragmentShader = `varying vec3 cavePoint; varying vec3 caveNormal; uniform vec4 stonePatch; ${paving ? 'uniform sampler2D flagstone;' : ''}\n`
      + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', `
      #include <map_pars_fragment>
      float caveHash(vec2 v) { return fract(sin(dot(v, vec2(52.13, 93.73))) * 21341.58); }
      float caveNoise(vec2 p) {
        vec2 f=fract(p), i=floor(p); f=f*f*(3.-2.*f);
        return mix(mix(caveHash(i),caveHash(i+vec2(1,0)),f.x),
                   mix(caveHash(i+vec2(0,1)),caveHash(i+1.),f.x),f.y);
      }
      vec3 sampleStone(vec2 p) {
        vec2 mirrored=1.-abs(fract(p*.5)*2.-1.);
        return texture2D(map, stonePatch.xy+stonePatch.zw*mirrored).rgb;
      }
    `).replace('#include <map_fragment>', `
      vec3 weights=pow(abs(normalize(caveNormal)), vec3(5.));
      weights/=max(dot(weights,vec3(1.)),.001);
      vec3 q=cavePoint*${scale.toFixed(2)};
      float weather=caveNoise(q.xz*.82+q.y*.64);
      vec3 atlas=sampleStone(q.yz)*weights.x+sampleStone(q.xz)*weights.y+sampleStone(q.xy)*weights.z;
      float textureGrain=clamp(dot(atlas,vec3(.36,.54,.10))*2.1, 0., 1.);
      float shale=sin(q.y*11.+sin(q.x*1.8+q.z)*2.1+caveNoise(q.xz*1.6)*2.5);
      float thinVein=smoothstep(.955,.998,shale) * smoothstep(.36,.78,weather);
      float patchiness=smoothstep(.29,.66,weather + textureGrain*.37);
      float reliefHeight=textureGrain*.15+weather*.13+thinVein*.08;
      diffuseColor.rgb *= ${surface === 'court'
        ? '.76 + textureGrain*.36 + patchiness*.19'
        : '.57 + textureGrain*.58 + patchiness*.38'};
      diffuseColor.rgb=mix(diffuseColor.rgb, vec3(.34,.205,.084)*(.63+textureGrain*.75),
        ${surface === 'court' ? '.065' : surface === 'vault' ? '.29' : surface === 'ridge' ? '.12' : '.22'}*patchiness+thinVein*.15);
      ${surface === 'court' ? `
        // Worn joins follow the stone courses, clear of the painted play lines.
        vec2 block=vec2(cavePoint.x+.48*mod(floor(cavePoint.z/1.54),2.),cavePoint.z);
        vec2 joint=abs(fract(block/vec2(1.95,1.54))-.5);
        float seam=smoothstep(.479,.499,max(joint.x,joint.y) + (weather-.5)*.027);
        vec2 tile=floor(block/vec2(1.95,1.54));
        float wear=caveNoise(cavePoint.xz*8.1)*.48+caveNoise(cavePoint.xz*2.51)*.32+textureGrain*.20;
        ${paving ? `
        vec2 slabUV=fract(block/vec2(1.95,1.54));
        slabUV=mix(slabUV,1.-slabUV,step(.5,vec2(caveHash(tile),caveHash(tile.yx+.5))));
        vec3 sampleBed=texture2D(flagstone,slabUV*.72+vec2(.23,.15)).rgb;
        diffuseColor.rgb=mix(diffuseColor.rgb,sampleBed*vec3(.27,.61,.75),.70);
        ` : ''}
        diffuseColor.rgb*=.78+.23*caveHash(tile);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.293,.145),smoothstep(.62,.79,wear)*.20);
        diffuseColor.rgb*=1.-seam*.34;
        reliefHeight-=seam*.09;
      ` : ''}
      ${surface === 'ridge' || surface === 'bank' ? `
        vec2 fracture=vec2(cavePoint.x+cavePoint.z*.72-cavePoint.y*.31,
                           cavePoint.y*.71+cavePoint.z*.15);
        float jointField=caveNoise(fracture*2.3)+.32*caveNoise(fracture*5.47);
        float crevice=1.-smoothstep(.016,.10,abs(jointField-.55));
        float crest=smoothstep(.57,.73,jointField);
        vec2 stoneUV=1.-abs(fract(fracture*vec2(.26,.32)) * 2.-1.);
        vec3 chips=texture2D(map,vec2(42./1672.,1.-748./941.)+stoneUV*vec2(112./1672.,93./941.)).rgb;
        float flake=clamp(dot(chips,vec3(.28,.52,.20))*4.5,0.,1.);
        diffuseColor.rgb*=.64+.69*flake+.15*crest-.115*crevice;
        diffuseColor.rgb+=vec3(.046,.029,.012)*crest*flake;
        reliefHeight+=.18*flake-.18*crevice+.14*jointField;
      ` : ''}
    `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 da=dFdx(vViewPosition), db=dFdy(vViewPosition);
      vec3 gradient=cross(db,normal)*dFdx(reliefHeight)+cross(normal,da)*dFdy(reliefHeight);
      float denominator=dot(da,cross(db,normal));
      normal=normalize(normal-max(-1., min(1.,1./(denominator+0.000001)))*gradient*${surface === 'court' ? '.06' : '.12'});
    `)
  }
  material.customProgramCacheKey = () => 'cave-mineral-' + surface
  return material
}
