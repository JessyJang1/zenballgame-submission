import { cutStone } from './assets/cutStone'
import { openingGeometry } from './assets/openingGeometry'
import { useMemo,useEffect } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BoxGeometry, BufferGeometry, Float32BufferAttribute, SRGBColorSpace, DoubleSide, RepeatWrapping, type Texture } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

function panels(){
  const chunks=Array.from({length:15},(_,i)=>new BoxGeometry(1.64,.59,.24).translate(-12.13+i*1.735,6.62,.24))
  const g=mergeGeometries(chunks);chunks.forEach(p=>p.dispose());return g
}

// The roof slabs project into the rock behind the rail. Stagger the
// soffit and roof joints so the two faces sit on the same masonry wall.
function cornice() {
  const pieces: BufferGeometry[] = []
  for (let index=0; index<20; index++) {
    const x = -12.35+index*1.3
    const back = 2.23+.22*Math.sin(index*.63)+.13*Math.cos(index*1.46)
    pieces.push(cutStone(1.292,.26,back+.50,.034).translate(x,6.10,(back-.50)/2))
    pieces.push(cutStone(1.294,.14,1.04,.024).translate(x+.08,5.91,.18))
  }
  const geometry = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i=0;i<uv.count;i++) uv.setXY(i,.91*position.getX(i),1.21*position.getY(i)+.52*position.getZ(i))
  return geometry
}

// An arched stone tablet. Sample the approved carving to model relief on
// its front; the reveal and stone sides remain visible from the aisle.
function tablet(map:Texture){
  const w=52,h=88,canvas=document.createElement('canvas')
  canvas.width=w+1;canvas.height=h+1
  const ctx=canvas.getContext('2d')!
  ctx.drawImage(map.image as HTMLImageElement,0,0,w+1,h+1)
  const rgba=ctx.getImageData(0,0,w+1,h+1).data
  const p:number[]=[],uv:number[]=[],ix:number[]=[]
  for(let r=0;r<=h;r++)for(let c=0;c<=w;c++){
    const u=c/w,v=r/h,k=r*(w+1)+c
    const top=1.95+.66*Math.sqrt(Math.max(0,1-(2*u-1)**2))
    const texel=((h-r)*(w+1)+c)*4
    const depth=(rgba[texel]*.6+rgba[texel+1]*.4)/255
    p.push((u-.5)*1.45,1.43+top*v,-.28*depth)
    uv.push(u,v)
    if(c&&r)ix.push(k-w-2,k-1,k,k,k-w-1,k-w-2)
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g
}
export default function CourtCloister(){
  const [pier,panel,carving]=useSceneTexture(['pier','rail','votive'].map(id=>import.meta.env.BASE_URL+'assets/art/gallery-'+id+'.webp'))
  for(const t of [pier,panel,carving])t.colorSpace=SRGBColorSpace
  const surface=useMemo(()=>{const t=pier.clone();t.wrapS=t.wrapT=RepeatWrapping;t.needsUpdate=true;return t},[pier])
  useEffect(()=>()=>surface.dispose(),[surface])
  const stones=useMemo(()=>openingGeometry('courses'),[]),rail=useMemo(panels,[]),relief=useMemo(()=>tablet(carving),[carving])
  const roof = useMemo(cornice,[])
  useEffect(()=>()=>{stones.dispose();rail.dispose();relief.dispose();roof.dispose()},[stones,rail,relief,roof])
  return <group name="Stone cloister and votive niches">
    <mesh geometry={stones} castShadow receiveShadow><meshStandardMaterial map={surface} color="#708c83" roughness={.92}/></mesh>
    <mesh geometry={roof} castShadow receiveShadow><meshStandardMaterial map={surface} color="#716d56" roughness={.93}/></mesh>
    <mesh geometry={rail} receiveShadow><meshStandardMaterial map={panel} roughness={.87}/></mesh>
    {[-10.4,-5.2,0,5.2,10.4].map((x,i)=><group key={x} position-x={x}>
      {i%2===0 && <mesh geometry={relief} position-z={3.40}><meshStandardMaterial map={carving} side={DoubleSide} emissiveMap={carving} emissive="#c79b68" emissiveIntensity={.27}/></mesh>}
    </group>)}
  </group>
}
