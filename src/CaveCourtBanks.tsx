import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { cutStone } from './assets/cutStone'
import { COURT_TERRACE } from './gardenLayout'
import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, type Texture } from 'three'
import { makeCaveStone } from './assets/caveStone'
import { terrainHeight } from './terrainSurface'

function shoreStone() {
  const positions: number[] = [], indices: number[] = []
  for(const sign of [-1,1]) {
    const rows=37,columns=13,offset=positions.length/3
    for(let j=0;j<=rows;j++) {
      const z=12.15-j/rows*28.1
      const border=8.34+.48*Math.sin(z*.43)+.15*Math.sin(z*1.25)
      const width=3+.6*Math.cos(z*.43+.6)
      for(let i=0;i<=columns;i++) {
        const s=i/columns
        const x=sign*(border+s*width)
        const envelope=Math.sin(s*Math.PI)*Math.sin(j/rows*Math.PI)**.45
        const rib=.53+.32*Math.sin(z*1.3+s*6)+.14*Math.sin(z*2.91-s*10)
        const base=terrainHeight(x,z)
        positions.push(x,base+.018+envelope*rib*.88,z)
        if(j&&i){
          const a=offset+j*(columns+1)+i,b=a-columns-1
          if(sign>0) indices.push(b-1,b,a-1,b,a,a-1)
          else indices.push(b-1,a-1,b,b,a-1,a)
        }
      }
    }
  }
  const mesh=new BufferGeometry()
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3))
  mesh.setIndex(indices)
  mesh.computeVertexNormals()
  return mesh
}

function grasses() {
  const positions: number[] = [],colors: number[] = []
  const shadow = new Color('#3b5437'), highlight = new Color('#a69a60'), color = new Color()
  let state=34913
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
  for(let tuft=0;tuft<84;tuft++){
    const side=tuft%2 ? 1 : -1
    const z=-14+random()*27
    const x=side*(9.7+random()*2)
    const ground=terrainHeight(x,z)
    if(ground<-.12)continue
    const y=ground+.27
    const size=.21+random()*.27
    for(let blade=0;blade<7;blade++){
      const angle=random()*Math.PI*2,h=size*(.42+random()*.85)
      const dx=Math.cos(angle),dz=Math.sin(angle),w=.027+random()*.035
      const baseX=x+(random()-.5)*.35,baseZ=z+(random()-.5)*.34
      positions.push(baseX+dx*w,y,baseZ+dz*w,baseX-dx*w,y,baseZ-dz*w,
        baseX+dx*h*.72,y+h,baseZ+dz*h*.72)
      color.copy(shadow).lerp(highlight,random()*.3)
      colors.push(color.r,color.g,color.b,color.r,color.g,color.b)
      color.lerp(highlight,.45)
      colors.push(color.r,color.g,color.b)
    }
  }
  const mesh=new BufferGeometry()
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3))
  mesh.setAttribute('color',new Float32BufferAttribute(colors,3))
  mesh.computeVertexNormals()
  return mesh
}

function retainingCourse(){
  const blocks=[]
  for(const [i,[ax,az]] of COURT_TERRACE.entries()){
    const [bx,bz]=COURT_TERRACE[(i+1)%COURT_TERRACE.length]
    const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),count=Math.ceil(length/1.2)
    for(let n=0;n<count;n++){
      const t=(n+.5)/count
      const lift=.017*Math.sin(n*2.77+i)
      const edge=length/count
      const x=ax+dx*t-dz/length*.10,z=az+dz*t+dx/length*.10
      blocks.push(cutStone(edge-.019,.18,.32,.027).rotateY(-Math.atan2(dz,dx)).translate(x,-.064+lift,z))
      blocks.push(cutStone(edge-.033,.35,.24,.023).rotateY(-Math.atan2(dz,dx)).translate(x,-.295,z))
    }
  }
  const geometry=mergeGeometries(blocks);blocks.forEach(mesh=>mesh.dispose())
  return geometry
}

export default function CaveCourtBanks({ atlas }: { atlas: Texture }) {
  const shore=useMemo(shoreStone,[])
  const reeds=useMemo(grasses,[])
  const coping=useMemo(retainingCourse,[])
  const material=useMemo(()=>makeCaveStone(atlas,'bank','#344f48'),[atlas])
  const wetStone=useMemo(()=>makeCaveStone(atlas,'bank','#606e61'),[atlas])
  useEffect(()=>()=>{shore.dispose();reeds.dispose();coping.dispose();material.dispose();wetStone.dispose()},[shore,reeds,coping,material,wetStone])
  return <group name="Moss banks around the playable terrace">
    <mesh geometry={coping} material={wetStone} receiveShadow/>
    <mesh geometry={shore} material={material} receiveShadow/>
    <mesh geometry={reeds}><meshBasicMaterial vertexColors side={DoubleSide}/></mesh>
  </group>
}
