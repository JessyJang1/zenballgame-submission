import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, MathUtils, type Texture } from 'three'
import { makeCaveStone } from './assets/caveStone'

type Ridge = {
  x: number; z: number; width: number; depth: number; tint: string
  crest: readonly number[]; tilt: number
}

// Each massif has an authored skyline, with saddles and rock shoulders between summits.
const ranges: Ridge[] = [
  { x:-28,z:-5,width:25,depth:24,tint:'#2b4845',crest:[0,9,18,19,17,23,21,13,8,0],tilt:.16 },
  { x:31,z:-11,width:25,depth:25,tint:'#36554f',crest:[0,7,13,17,29,28,25,24,15,19,8,0],tilt:-.18 },
  { x:-32,z:-36,width:38,depth:21,tint:'#4e7069',crest:[0,11,21,21,25,31,29,24,18,23,20,10,0],tilt:.27 },
  { x:32,z:-38,width:34,depth:23,tint:'#597a72',crest:[0,13,19,24,23,27,37,37,33,31,22,14,0],tilt:-.20 },
  { x:-30,z:-62,width:34,depth:22,tint:'#688379',crest:[0,13,25,37,39,36,30,28,31,24,20,6,0],tilt:-.16 },
  { x:35,z:-69,width:39,depth:22,tint:'#6b8276',crest:[0,16,22,19,30,38,42,43,36,32,27,12,0],tilt:.20 },
  { x:-9,z:-87,width:48,depth:21,tint:'#82958a',crest:[0,20,26,24,35,41,40,36,31,34,31,20,10,0],tilt:-.14 },
  { x:20,z:-97,width:52,depth:16,tint:'#95a69a',crest:[0,19,22,27,31,44,46,41,35,39,37,28,21,10,0],tilt:.16 },
]

function carveMassif(ridge: Ridge, seed: number) {
  const columns = 88, rows = 29
  const positions: number[] = [], indices: number[] = []
  for (let row=0; row<=rows; row++) {
    const v=row/rows
    // The front face rises fast, while the back falls away across deep shelves.
    const front=Math.min(1,v/.48), back=Math.max(0,(v-.48)/.52)
    const section=Math.pow(Math.sin(front*Math.PI/2),.93)*Math.pow(Math.cos(back*Math.PI/2),.67)
    for (let col=0; col<=columns; col++) {
      const u=col/columns
      const t=u*(ridge.crest.length-1), i=Math.floor(t), f=t-i
      const crest=MathUtils.lerp(ridge.crest[i],ridge.crest[Math.min(i+1,ridge.crest.length-1)],f)
      const buttress=Math.cos(58*u+v*9+seed)*.32 + Math.sin(29*u-v*5+seed)*.65
      const erosion=(Math.sin(u*163+v*36)*.20 + Math.sin(u*71-v*19+seed)*.49)*section
      const shelf=Math.sin(v*24+u*9)*.36
      const y=-3.15+section*(crest*(.95+buttress*.07)+buttress*1.4+shelf+erosion)
      const x=ridge.x+(u-.5)*ridge.width+ridge.tilt*y+Math.sin(v*4+u*7)*section*1.45
      // Buttresses run downhill, splitting into gullies below the crest.
      const runnel = u*37 + .83*Math.sin(u*11+seed) + .49*v
      const rib = Math.abs(Math.sin(runnel))**1.35
      const spur = (rib-.43)*4.6 + Math.cos(runnel*2.7+v*3)*.53
      const z=ridge.z+spur*section+(.5-v)*ridge.depth+Math.sin(u*22+v*6+seed)*section*.96
      positions.push(x,y,z)
      if(row&&col){
        const a=row*(columns+1)+col, b=a-columns-1
        indices.push(b-1,b,a-1,b,a,a-1)
      }
    }
  }
  const mesh=new BufferGeometry()
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3))
  mesh.setIndex(indices)
  mesh.computeVertexNormals()
  return mesh
}

export default function CaveRidges({ atlas }: { atlas: Texture }) {
  const mountains=useMemo(()=>ranges.map((ridge,i)=>({
    geometry:carveMassif(ridge,i*1.72),
    material:makeCaveStone(atlas,'ridge',ridge.tint),
  })),[atlas])
  useEffect(()=>()=>mountains.forEach(({geometry,material})=>{geometry.dispose();material.dispose()}),[mountains])
  return <group name="Cave valley: near cliffs and layered massifs">
    {mountains.map(({geometry,material})=><mesh key={geometry.uuid} geometry={geometry} material={material}/>)}
  </group>
}
