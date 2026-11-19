import { Suspense, useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three'
import { useGLTF } from '@react-three/drei'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RIDGE_WALK, SUMMIT } from './paintingLayout'
import { makeCaveStone } from './assets/caveStone'
import { makeBark, makeNeedles } from './ThresholdPine'
import { ModelFallback } from './assets/AssetSlots'
import { useSceneTexture } from './assets/useSceneTexture'

type Stratum = { x: number; y: number; z: number; width: number; depth: number; height: number; turn: number }

// Outside the rally area, the terrace shoulder and the high landing share
// tilted beds. Keep the space between both shoulders open over the chasm.
const ledges: Stratum[] = [
  {x:-8.65,y:3.2,z:-30.4,width:2.15,depth:3.9,height:6.5,turn:.42},
  {x:-9.05,y:7.10,z:-37.4,width:2.25,depth:4.2,height:8.2,turn:-.29},
  {x:-8.65,y:6.20,z:-42.9,width:2.5,depth:3.3,height:9.1,turn:.32},
  {x:5.9,y:4.45,z:-34.85,width:2.03,depth:4.5,height:7.6,turn:.21},
  {x:6.4,y:5.2,z:-41.85,width:2.4,depth:4.2,height:9.3,turn:-.31},
  {x:RIDGE_WALK.x-2.22,y:RIDGE_WALK.y-.32,z:RIDGE_WALK.z+.55,width:.92,depth:2.05,height:5.8,turn:.20},
  {x:RIDGE_WALK.x+2.30,y:RIDGE_WALK.y-.34,z:RIDGE_WALK.z+.44,width:.78,depth:2.33,height:5.5,turn:-.18},
  // The main buttress rises out of the ravine under the entire high shelf.
  {x:SUMMIT.x-.28,y:11.16,z:-61.15,width:6.25,depth:7.0,height:22.5,turn:-.36},
  {x:SUMMIT.x-2.85,y:SUMMIT.y-1.75,z:-56.3,width:1.62,depth:2.55,height:16.1,turn:.24},
  {x:SUMMIT.x+2.73,y:SUMMIT.y-1.15,z:-56.54,width:1.54,depth:2.25,height:17.6,turn:-.22},
]

function cutEscarpment({x,y,z,width,depth,height,turn}: Stratum, seed:number) {
  const points:number[]=[], colors:number[]=[], indices:number[]=[]
  const jade=new Color('#365e54'), warm=new Color('#ac9a72'), dark=new Color('#283d36')
  const color=new Color()
  const rows=12, count=24
  for (let row=0;row<=rows;row++) {
    const h=row/rows, bed=(row%3===1 ? -.093 : row%3===2 ? .062 : 0)
    const shoulder=1.25-.52*h+bed
    for (let side=0;side<count;side++) {
      const a=side/count*Math.PI*2
      const cut=1+.11*Math.sin(a*3+seed)-.10*Math.cos(a*7+seed)**4
      const angle=a+turn
      const radius=shoulder*cut
      const slope=.37*Math.cos(a+seed*.43)*(1-h*.48)
      points.push(x+Math.cos(angle)*width*radius+.6*(1-h),y-(1-h)*height+slope,
        z+Math.sin(angle)*depth*radius-.42*(1-h))
      color.copy(jade).lerp(warm,.32+.24*Math.cos(a+seed)**4+.27*h**5)
        .lerp(dark,(1-h)*.39+(row%3===1?.17:0))
      colors.push(color.r,color.g,color.b)
      if (row) {
        const u=(row-1)*count+side,v=(row-1)*count+(side+1)%count
        indices.push(u,u+count,v,v,u+count,v+count)
      }
    }
  }
  const cap=points.length/3
  points.push(x,y+.12,z); colors.push(warm.r,warm.g,warm.b)
  for(let side=0;side<count;side++)indices.push(cap,rows*count+(side+1)%count,rows*count+side)
  const g=new BufferGeometry()
  g.setAttribute('position',new Float32BufferAttribute(points,3))
  g.setAttribute('color',new Float32BufferAttribute(colors,3))
  g.setIndex(indices);g.computeVertexNormals()
  return g
}

function cliffPine(g: BufferGeometry) {
  const trees = [[-9.05,7.19,-37.4,.48,-.68],[-8.65,6.26,-42.9,.36,1.27]]
  const pieces = trees.map(([x,y,z,size,angle]) => g.clone().translate(8.4,0,-49.8).scale(size,size,size)
    .rotateY(angle).translate(x,y,z))
  const merged = mergeGeometries(pieces)
  g.dispose()
  pieces.forEach(part=>part.dispose())
  return merged
}

const cliffPath = import.meta.env.BASE_URL + 'assets/models/third-party/polyhaven-rock-face-01.glb'

export function preloadCloudCliff() {
  useGLTF.preload(cliffPath, false, false)
}

function SummitCliffFace() {
  const { scene } = useGLTF(cliffPath, false, false)
  const { geometry, material } = useMemo(() => {
    const mesh = scene.children.find((child): child is Mesh<BufferGeometry, MeshStandardMaterial> =>
      child instanceof Mesh && child.material instanceof MeshStandardMaterial)
    if (!mesh) throw new Error('Poly Haven rock mesh missing')
    const stone = mesh.material.clone()
    stone.color.set('#9cb2a0')
    stone.normalScale.set(.76, .76)
    return { geometry: mesh.geometry, material: stone }
  }, [scene])
  useEffect(() => () => material.dispose(), [material])
  return <group name="Faulted headlands below the moon terrace" dispose={null}>
    <mesh geometry={geometry} material={material} position={[-1.63,3.15,-53.9]} rotation-y={.13} scale={[2.02,2.10,1.49]} receiveShadow />
    <mesh geometry={geometry} material={material} position={[4.25,3.13,-57.10]} rotation-y={-.37} scale={[1.15,2.1,1.22]} receiveShadow />
  </group>
}

export default function CloudEscarpment() {
  const atlas=useSceneTexture(import.meta.env.BASE_URL+'assets/art/stone-prologue-card.png')
  const rock=useMemo(()=>{
    const pieces=ledges.map(cutEscarpment)
    const geometry=mergeGeometries(pieces)
    pieces.forEach(g=>g.dispose())
    return geometry
  },[])
  const material=useMemo(()=>{
    const pigment=makeCaveStone(atlas,'ridge','#e0d9b8')
    pigment.vertexColors=true
    return pigment
  },[atlas])
  const pines = useMemo(() => ({trunks:cliffPine(makeBark()), crowns:cliffPine(makeNeedles(true))}), [])
  useEffect(()=>()=>{rock.dispose();material.dispose();pines.trunks.dispose();pines.crowns.dispose()},[rock,material,pines])
  return <group name="Cloud terrace and summit abutments">
    <mesh geometry={rock} material={material} receiveShadow/>
    <ModelFallback slot="cloud-cliff" fallback={null}>
      <Suspense fallback={null}><SummitCliffFace/></Suspense>
    </ModelFallback>
    <mesh geometry={pines.trunks}><meshStandardMaterial vertexColors roughness={1}/></mesh>
    <mesh geometry={pines.crowns}><meshStandardMaterial side={DoubleSide} vertexColors roughness={1}/></mesh>
  </group>
}
