import { AssetSlot } from './assets/AssetSlots'
import { useEffect,useMemo } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BoxGeometry,BufferGeometry,CatmullRomCurve3,Color,ExtrudeGeometry,Float32BufferAttribute,Shape,TubeGeometry,Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeCaveStone } from './assets/caveStone'

const roofWidth=7.52
const eaveDepth=1.72
function roofPoint(u:number,v:number){
  const edge=Math.abs(u), fall=Math.abs(v)
  return new Vector3(u*(roofWidth*.5-.61*(1-fall)),4.78-1.06*fall+.36*fall**4+.46*edge**6,
    v*(eaveDepth+.25*edge**5))
}
function roof(){
  const position:number[]=[],colors:number[]=[],indices:number[]=[]
  const columns=86,rows=32
  const base=new Color('#365854'), ridge=new Color('#667467')
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const u=2*col/columns-1,v=2*row/rows-1,p=roofPoint(u,v)
    const tile=(.5+.5*Math.cos(u*Math.PI*43))**1.4
    p.y+=.039*tile
    position.push(...p.toArray())
    const glaze=base.clone().lerp(ridge,.15+tile*.43+.17*Math.sin(col*1.7+Math.floor(Math.abs(v)*7)))
    colors.push(glaze.r,glaze.g,glaze.b)
    const k=row*(columns+1)+col
    if(col&&row)indices.push(k-columns-2,k-1,k,k-columns-2,k,k-columns-1)
  }
  const g=new BufferGeometry()
  g.setAttribute('position',new Float32BufferAttribute(position,3))
  g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals()
  return g
}
function combine<T extends BufferGeometry>(parts:T[]){
  const g=mergeGeometries(parts);parts.forEach(part=>part.dispose());return g
}
function trim(){
  const bars:TubeGeometry[]=[]
  function rod(points:Vector3[],radius:number){
    bars.push(new TubeGeometry(new CatmullRomCurve3(points),22,radius,7,false))
  }
  for(const v of [-1,0,1]){
    const points=Array.from({length:15},(_,i)=>roofPoint(i/7-1,v))
    rod(points,v===0?.075:.065)
    if(v!==0)rod(points.map(p=>p.clone().add(new Vector3(0,-.17,-Math.sign(v)*.035))),.052)
  }
  for(const u of [-1,1]){
    rod(Array.from({length:17},(_,i)=>roofPoint(u,i/8-1)),.07)
    for(const v of [-1,1]){
      const tip=roofPoint(u,v)
      rod([tip.clone().add(new Vector3(-u*.39,-.15,0)),tip,
        tip.clone().add(new Vector3(u*.15,.13,0)),tip.clone().add(new Vector3(u*.23,.37,-v*.05))],.056)
    }
  }
  return combine(bars)
}
function gateWall(){
  const arch=new Shape()
  arch.moveTo(-2.83,-.14);arch.lineTo(-1.24,-.14);arch.lineTo(-1.24,1.61)
  arch.absarc(0,1.61,1.24,Math.PI,0,true)
  arch.lineTo(1.24,-.14);arch.lineTo(2.83,-.14);arch.lineTo(2.83,3.76)
  arch.lineTo(-2.83,3.76);arch.closePath()
  return new ExtrudeGeometry(arch,{depth:.76,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:2,curveSegments:24}).translate(0,0,-.39)
}
function transom(){
  const shape=new Shape()
  shape.moveTo(-.99,2.43);shape.lineTo(.99,2.43)
  shape.absarc(0,1.61,1.23,.723,Math.PI-.723,false);shape.closePath()
  return new ExtrudeGeometry(shape,{depth:.19,bevelEnabled:false,curveSegments:20}).translate(0,0,.10)
}
function timbers(){
  const parts:BoxGeometry[]=[]
  function beam(x:number,y:number,z:number,w:number,h:number,d:number){parts.push(new BoxGeometry(w,h,d).translate(x,y,z))}
  for(const z of [-.53,.60]){
    for(const x of [-2.63,-1.51,1.51,2.63]){
      beam(x,1.77,z,.23,3.47,.28)
      beam(x,3.45,z,.49,.18,.46)
      beam(x,3.64,z,.65,.20,.65)
    }
    beam(0,3.33,z,5.77,.20,.27)
    beam(0,3.72,z,6.15,.15,.35)
  }
  for(let n=-4;n<=4;n++)for(const side of [-1,1]){
    const x=n*.68,z=side*.74
    beam(x,3.57,z,.15,.17,.57)
    beam(x,3.72,z+.18*side,.25,.14,.44)
  }
  for(let n=-13;n<=13;n++)for(const side of [-1,1]){
    const u=n/14,end=roofPoint(u,side*.98)
    beam(end.x,end.y-.135,end.z-.20*side,.086,.15,.46)
  }
  return combine(parts)
}
function archTrim(){
  const jambs=[new Vector3(-1.24,-.02,.445),new Vector3(-1.24,1.57,.445)]
  for(let i=0;i<=20;i++){
    const a=Math.PI-i*Math.PI/20
    jambs.push(new Vector3(1.24*Math.cos(a),1.61+1.24*Math.sin(a),.445))
  }
  jambs.push(new Vector3(1.24,1.57,.445),new Vector3(1.24,-.02,.445))
  return new TubeGeometry(new CatmullRomCurve3(jambs),60,.051,8,false)
}
export default function CourtMountainGate(){
  const atlas=useSceneTexture(import.meta.env.BASE_URL+'assets/art/stone-prologue-card.png')
  const parts=useMemo(()=>[gateWall(),roof(),trim(),timbers(),archTrim(),transom()],[])
  const plaster=useMemo(()=>makeCaveStone(atlas,'bank','#813f31'),[atlas])
  useEffect(()=>()=>{parts.forEach(part=>part.dispose());plaster.dispose()},[parts,plaster])
  const [wall,tiles,corners,brackets,jamb,lintel]=parts
  return <group name="Cinnabar gate with curved ceramic roof">
    <mesh geometry={wall} material={plaster} castShadow receiveShadow/>
    <group position-y={3.80}>
      <AssetSlot slot="courtyardRoof" fit={[7.52,1.38,3.45]}>
        <group position-y={-3.80}>
          <mesh geometry={tiles} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.71}/></mesh>
          <mesh geometry={corners} castShadow receiveShadow><meshStandardMaterial color="#a28754" roughness={.75}/></mesh>
        </group>
      </AssetSlot>
    </group>
    <mesh geometry={brackets} castShadow receiveShadow><meshStandardMaterial color="#6e422c" roughness={.84}/></mesh>
    <mesh geometry={lintel} receiveShadow><meshStandardMaterial color="#563a29" roughness={.91}/></mesh>
    <mesh geometry={jamb} receiveShadow><meshStandardMaterial color="#bb8a4b" roughness={.87}/></mesh>
  </group>
}
