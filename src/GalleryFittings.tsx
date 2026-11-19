import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, BoxGeometry, BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three'
import { useSceneTexture } from './assets/useSceneTexture'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Pierced balustrade above the arcade. The two rails are supported by the
// same pier centres as the vaults below and remain legible in silhouette.
function parapet(){
  const pieces:BoxGeometry[]=[]
  const beam=(x:number,y:number,w:number,h:number,d:number)=>pieces.push(new BoxGeometry(w,h,d).translate(x,y,.25))
  beam(0,6.42,26,.10,.23);beam(0,7,26,.13,.28)
  for(let i=0;i<=20;i++){
    const x=-13+i*1.3, pier=i%4===0
    beam(x,6.67,pier?.31:.15,pier?1.08:.61,pier?.4:.22)
    if(pier)beam(x,7.23,.43,.12,.48)
  }
  const geometry=mergeGeometries(pieces);pieces.forEach(part=>part.dispose())
  return geometry
}

function silk(){
  const p:number[]=[],indices:number[]=[],uv:number[]=[]
  const rows=20,cols=10
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows
    uv.push(u,1-v)
    p.push((u-.5)*1.06,6.01-v*(3.15+.45*(1-Math.abs(2*u-1))),
      -.59+.081*Math.sin(11*u+v*1.8)-.08*v*v)
    const k=j*(cols+1)+i
    if(i&&j)indices.push(k-cols-2,k-cols-1,k,k-cols-2,k,k-1)
  }
  const cloth=new BufferGeometry()
  cloth.setAttribute('position',new Float32BufferAttribute(p,3));cloth.setAttribute('uv',new Float32BufferAttribute(uv,2));cloth.setIndex(indices);cloth.computeVertexNormals()
  return cloth
}
export default function GalleryFittings(){
  const rail=useMemo(parapet,[]),pendant=useMemo(silk,[]),thread=useSceneTexture(import.meta.env.BASE_URL+'assets/art/gallery-silk.webp')
  thread.colorSpace=SRGBColorSpace
  useEffect(()=>()=>{rail.dispose();pendant.dispose()},[rail,pendant])
  return <>
    <mesh geometry={rail} castShadow receiveShadow><meshStandardMaterial color="#a19778" roughness={.89}/></mesh>
    {[-7.8,2.6].map(x=><mesh key={x} position-x={x} geometry={pendant} receiveShadow><meshStandardMaterial map={thread} roughness={.94} side={DoubleSide}/></mesh>)}
  </>
}
