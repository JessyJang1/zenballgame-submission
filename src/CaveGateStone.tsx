import CourtLanterns from './CourtLanterns'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Shape, SRGBColorSpace, type Group } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeCaveStone } from './assets/caveStone'
import type { Ritual } from './rally'
import { CLOUD_TERRACE, GATE_WALK } from './paintingLayout'

export const gateRoute = [
  [0,.18,-11.8],[-.10,.23,-12.5],[-.31,.29,-13.2],[-.62,.40,-13.9],
  [-1.02,.52,-14.6],[-1.30,.66,-15.32],[-1.5,.78,-16.04],[-1.5,.81,-17],
] as const

function stoneOutline(points: readonly (readonly [number,number])[]) {
  const shape = new Shape()
  points.forEach(([x,z],i)=>i ? shape.lineTo(x,-z) : shape.moveTo(x,-z))
  shape.closePath()
  return shape
}

const walkJoinZ = GATE_WALK.endZ - CLOUD_TERRACE.z
const walkJoinEdge = GATE_WALK.width / 2 + .06
const rim = [
  [-7.42,-9.4],[-5.6,-10.02],[-1.4,-9.8],[2.12,-10.36],[5.52,-9.4],[6.71,-9.21],
  [6.24,-4.7],[6.83,-.94],[6.79,1.6],[6.27,5.9],[5.9,9.4],[2.1,9.32],
  [walkJoinEdge,walkJoinZ],[-walkJoinEdge,walkJoinZ],
  [-2.3,9.55],[-4.1,9.52],[-6.33,9.27],[-6.24,5.64],[-7.17,1.92],[-6.71,-2.42],[-7.23,-6.72],
] as const

function terraceFace() {
  const positions:number[] = [],indices:number[] = []
  const n=rim.length
  for(let row=0;row<4;row++){
    for(let i=0;i<n;i++){
      const [x,z]=rim[i]
      const foot=row/3
      const flare=1+foot*(.14+Math.sin(i*1.91)*.055)
      const depth=foot*(1.04+.45*Math.sin(i*1.2)**2)
      positions.push(x*flare,-depth,z*flare)
      if(row){
        const a=(row-1)*n+i,b=(row-1)*n+(i+1)%n
        indices.push(a,b,a+n,b,b+n,a+n)
      }
    }
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setIndex(indices);geometry.computeVertexNormals()
  return geometry
}

function useGateMaterials() {
  const atlas=useSceneTexture(import.meta.env.BASE_URL+'assets/art/stone-prologue-card.png')
  atlas.colorSpace=SRGBColorSpace
  const paving = useSceneTexture(import.meta.env.BASE_URL+'assets/art/gallery-flagstone.webp')
  paving.colorSpace = SRGBColorSpace
  const top = useMemo(() => makeCaveStone(atlas, 'bank', '#877f63'), [atlas])
  const walk = useMemo(() => makeCaveStone(atlas, 'court', '#728579', paving), [atlas, paving])
  const side=useMemo(()=>makeCaveStone(atlas,'bank','#2c453d'),[atlas])
  side.side=DoubleSide
  useEffect(()=>()=>{top.dispose();side.dispose();walk.dispose()},[top,side,walk])
  return {top,side,walk}
}

export function CloudLedge({ritual}:{ritual:Ritual}) {
  const ledge=useRef<Group>(null)
  const {top,side,walk}=useGateMaterials()
  const outline=useMemo(()=>stoneOutline(rim),[])
  const inset = useMemo(() => stoneOutline([
    [-1.62,9.02],[1.62,9.02],[2.33,6.32],[3.95,4.62],[4.75,1.75],
    [4.78,-2.2],[3.95,-5.7],[2.45,-7.54],[2.69,-8.98],[-2.69,-8.98],
    [-2.37,-7.36],[-4.68,-5.58],[-4.95,-2.38],[-4.78,1.02],[-3.83,4.32],[-2.47,6.31],
  ]), [])
  const face=useMemo(terraceFace,[])
  useEffect(()=>()=>face.dispose(),[face])
  // The continuous terrain is visible from the first court. Bring in the dressed
  // ledge once the approach camera is under the gate roof.
  useFrame(({camera})=>{
    if(ledge.current) ledge.current.visible = ritual==='cleared' ? camera.position.z < -13.5 :
      ritual!=='lotus' && ritual!=='bell' && ritual!=='passage'
  })
  return <group ref={ledge} visible={false} name="Cloud court on a natural stone shelf" position={[CLOUD_TERRACE.x,CLOUD_TERRACE.y,CLOUD_TERRACE.z]}>
    <mesh rotation-x={-Math.PI/2} receiveShadow material={top}><shapeGeometry args={[outline]}/></mesh>
    <mesh rotation-x={-Math.PI/2} position-y={.013} receiveShadow material={walk} name="Worn stone inlay along the mountain route">
      <shapeGeometry args={[inset]}/>
    </mesh>
    <mesh geometry={face} material={side} receiveShadow/>
  </group>
}

export function RoughGateSteps() {
  const atlas=useSceneTexture(import.meta.env.BASE_URL+'assets/art/stone-prologue-card.png')
  atlas.colorSpace=SRGBColorSpace
  const material=useMemo(()=>makeCaveStone(atlas,'road','#b19a74'),[atlas])
  const mesh=useMemo(()=>{
    const pieces=gateRoute.map(([x,y,z],i)=>{
      const positions:number[] = [], indices:number[] = [], n=8
      const width=2.96+.38*(1-i/(gateRoute.length-1))
      const corners=[[-1,-.30],[-.91,-.42],[.78,-.46],[1,-.25],[.95,.32],[.71,.46],[-.81,.45],[-1,.31]]
      for(let row=0;row<3;row++) corners.forEach(([sx,sz],j)=>{
        const s=row===2?.95:row===0?.92:1
        positions.push(sx*width*s+Math.sin(i*4+j)*.073,[-.4,-.10,0][row]+.011*Math.sin(i*2+j),sz*s+.035*Math.cos(i+j*2))
        if(row){
          const a=(row-1)*n+j,b=(row-1)*n+(j+1)%n
          indices.push(a,a+n,b,b,a+n,b+n)
        }
      })
      for(let j=1;j<n-1;j++)indices.push(n*2,n*2+j+1,n*2+j)
      const geometry=new BufferGeometry()
      geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
      geometry.setIndex(indices);geometry.computeVertexNormals()
      return geometry.rotateY(Math.atan2((gateRoute[i-1]?.[0] ?? x)-x,.73)*.16).translate(x,y-.02,z)
    })
    const combined=mergeGeometries(pieces)
    pieces.forEach(piece=>piece.dispose())
    return combined
  },[])
  useEffect(()=>()=>{mesh.dispose();material.dispose()},[mesh,material])
  return <>
    <mesh name="Weathered steps to the gate" geometry={mesh} material={material} receiveShadow/>
    <CourtLanterns atlas={atlas} besideGate/>
  </>
}
