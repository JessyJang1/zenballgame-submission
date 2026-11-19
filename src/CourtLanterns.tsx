import {useEffect,useMemo} from 'react'
import {BoxGeometry,BufferGeometry,Color,Float32BufferAttribute,LatheGeometry,Vector2,Vector3,Quaternion,type Texture} from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {makeCaveStone} from './assets/caveStone'

// Each face of the hexagonal lantern has its own inset diamond grille.
// The bronze lattice sits just in front of the light, leaving clear openings.
function lattice(){
  const bars:BufferGeometry[]=[]
  const vertical=new Vector3(0,1,0)
  function join(a:Vector3,b:Vector3){
    const axis=b.clone().sub(a)
    bars.push(new BoxGeometry(.018,axis.length(),.024).toNonIndexed()
      .applyQuaternion(new Quaternion().setFromUnitVectors(vertical,axis.normalize()))
      .translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2))
  }
  for(let side=0;side<6;side++){
    const a=side*Math.PI/3,b=a+Math.PI/3,r=.321
    const ax=Math.sin(a)*r,az=Math.cos(a)*r,bx=Math.sin(b)*r,bz=Math.cos(b)*r
    const at=(u:number,v:number)=>new Vector3(ax+(bx-ax)*u,.905+v*.52,az+(bz-az)*u)
    join(at(0,.12),at(1,.12));join(at(0,.88),at(1,.88))
    for(const sign of [-1,1])for(const intercept of [-.45,-.10,.25,.60,.95]){
      const left=Math.max(.04,(.12-intercept)/1.6),right=Math.min(.96,(.88-intercept)/1.6)
      if(left>=right)continue
      join(at(sign>0?left:1-left,intercept+left*1.6),at(sign>0?right:1-right,intercept+right*1.6))
    }
  }
  const geometry=mergeGeometries(bars);bars.forEach(bar=>bar.dispose());return geometry
}

function lantern(){
  const profile=[[.45,0],[.50,.07],[.50,.15],[.39,.22],[.36,.26],[.29,.31],[.26,.64],[.35,.73],[.43,.77],[.42,.86],[.32,.91]]
  const stem=new LatheGeometry(profile.map(([r,y])=>new Vector2(r,y)),8).toNonIndexed()
  const capProfile=[[.37,1.42],[.54,1.46],[.64,1.52],[.61,1.56],[.48,1.59],[.34,1.68],[.20,1.80],[.12,1.86],[.14,1.93],[.085,2.01],[.01,2.09]]
  const cap=new LatheGeometry(capProfile.map(([r,y])=>new Vector2(r,y)),6).toNonIndexed()
  const parts=[stem,cap]
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3
    for(const [r,s] of [[.33,.063],[.285,.025]]){
      const post=new BoxGeometry(s,.58,s).toNonIndexed()
      parts.push(post.rotateY(a).translate(Math.sin(a)*r,1.165,Math.cos(a)*r))
    }
  }
  const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());return geo
}
const gateSites=[[-4.55,.62,-16.2,.93],[1.56,.62,-16.2,.93]] as const
const waterSites=[[-8.65,.29,-1.25,.8],[8.67,.37,7.72,1.08]] as const
export default function CourtLanterns({atlas, besideGate=false}:{atlas:Texture; besideGate?:boolean}){
  const sites=besideGate ? gateSites : waterSites
  const stone=useMemo(lantern,[]),grille=useMemo(lattice,[]),mat=useMemo(()=>makeCaveStone(atlas,'bank','#927d5c'),[atlas])
  const lit=useMemo(()=>{
    const geo=new BufferGeometry(),p:number[]=[],c:number[]=[]
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3,b=a+Math.PI/3
      for(const [angle,y] of [[a,.9],[b,.9],[b,1.44],[a,.9],[b,1.44],[a,1.44]]){
        p.push(Math.sin(angle)*.305,y,Math.cos(angle)*.305)
        const col=new Color(y<1?'#f4a443':'#ffdf99');c.push(col.r,col.g,col.b)
      }
    }
    geo.setAttribute('position',new Float32BufferAttribute(p,3));geo.setAttribute('color',new Float32BufferAttribute(c,3));return geo
  },[])
  useEffect(()=>()=>{stone.dispose();grille.dispose();mat.dispose();lit.dispose()},[stone,grille,mat,lit])
  return <group name="Carved lamps on the water and gate terrace">
    {sites.map(([x,y,z,size])=><group key={x} position={[x,y,z]} scale={size}>
      <mesh geometry={stone} material={mat} castShadow receiveShadow/>
      <mesh geometry={grille}><meshStandardMaterial color="#755633" roughness={.64} metalness={.22}/></mesh>
      <mesh geometry={lit}><meshBasicMaterial vertexColors toneMapped={false}/></mesh>
    </group>)}
  </group>
}
