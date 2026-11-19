import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, Matrix4, type Texture } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeCaveStone } from './assets/caveStone'
import { ThresholdStoneAsset, ThresholdStoneBoundary } from './assets/ThresholdStoneSet'

const path = [
  [-.1,57.5,2.25,1.25,.19], [.47,54.8,1.65,1.03,-.22], [-.47,52,1.8,1.17,.14],
  [.2,49.3,1.64,1.14,-.14], [.56,46.55,1.43,.98,.19], [-.27,43.95,1.65,1.07,.05],
  [.23,41.1,1.94,1.11,-.14], [.71,38.15,1.75,1.1,.14], [.21,35.3,1.97,1.26,-.1],
  [-.28,32.35,1.72,1.07,.18], [.54,29.65,1.76,1.18,-.10], [.19,26.7,1.85,1.25,.05],
  [-.29,23.83,1.83,1.27,-.13], [.18,20.95,2.01,1.14,.07], [.35,18.3,2.27,1.14,-.05],
  [0,15.72,2.93,1.23,.03], [0,13.56,4.52,1.01,.015],
]

function rockSlab(seed: number, h: number, worn = false) {
  const points: number[] = [], triangles: number[] = []
  const n = worn ? 28 : 20
  const tiers = worn
    ? [[.83,-.35],[.96,-.24],[.95,-.145],[1,-.075],[.96,h-.095],[.87,h],[.57,h+.008],[.25,h+.016],[.04,h+.006]]
    : [[.85,-.35],[1,-.22],[.97,h-.11],[.80,h],[.04,h-.025]]
  tiers.forEach(([radius, y], ring) => {
    for (let i=0;i<n;i++) {
      const theta=i/n*Math.PI*2
      const r=radius*(1+.07*Math.sin(i*2.74+seed)+.10*Math.sin(i*.91-seed))
      points.push(Math.cos(theta)*r,y+Math.sin(i*1.67+seed)*.044*radius,Math.sin(theta)*r)
      if (ring) {
        const a=(ring-1)*n+i,b=(ring-1)*n+(i+1)%n
        triangles.push(a,a+n,b,b,a+n,b+n)
      }
    }
  })
  const center=points.length/3
  points.push(0,h-.028,0)
  for(let i=0;i<n;i++) triangles.push(center,(tiers.length-1)*n+(i+1)%n,(tiers.length-1)*n+i)
  const mesh=new BufferGeometry()
  mesh.setAttribute('position',new Float32BufferAttribute(points,3))
  mesh.setIndex(triangles);mesh.computeVertexNormals()
  return mesh
}

const heroPavers = [
  {index:4,name:'ThresholdPaverA',nominalWidth:1.50,nominalDepth:1.00},
  {index:5,name:'ThresholdPaverB',nominalWidth:1.63,nominalDepth:1.08},
  {index:6,name:'ThresholdPaverA',nominalWidth:1.50,nominalDepth:1.00},
] as const

export default function CaveStonework({ atlas }: { atlas: Texture }) {
  const [road, fittedRoad, banks] = useMemo(() => {
    const transform = new Matrix4()
    const course = path.map(([x,z,w,d,yaw], i) => rockSlab(i*1.9,.19+i/220,z<41)
      .scale(w,1,d).applyMatrix4(transform.makeRotationY(yaw)).translate(x,0,z))
    const shoulders = Array.from({length: 26}, (_, i) => {
      const side = i%2 ? -1 : 1
      const point= Math.floor(i/2)
      const x=side*(9.2+Math.sin(point*1.1)*.85+point*.09)
      const z=9.8+point*2.04
      return rockSlab(i*2.45,.32+Math.sin(i*1.67)**2*.91)
        .scale(1.48+Math.sin(i*.93)**2,1,1.25+Math.sin(i*1.72)**2*.74)
        .rotateY(i*2.39).translate(x,-.23,z)
    })
    const standard = course.filter((_,index)=>!heroPavers.some(paver=>paver.index===index))
    const result = [mergeGeometries(course),mergeGeometries(standard),mergeGeometries(shoulders)] as const
    for (const item of [...course,...shoulders]) item.dispose()
    return result
  }, [])
  const roadMaterial = useMemo(()=>makeCaveStone(atlas,'road','#ac8e60'),[atlas])
  const bankMaterial = useMemo(()=>makeCaveStone(atlas,'bank','#45665c'),[atlas])
  useEffect(()=>()=>{road.dispose();fittedRoad.dispose();banks.dispose();roadMaterial.dispose();bankMaterial.dispose()},[road,fittedRoad,banks,roadMaterial,bankMaterial])
  return <group name="Limestone approach and jade banks">
    <ThresholdStoneBoundary fallback={<mesh geometry={road} material={roadMaterial} receiveShadow dispose={null}/>}>
      <mesh geometry={fittedRoad} material={roadMaterial} receiveShadow dispose={null}/>
      {heroPavers.map(({index,name,nominalWidth,nominalDepth})=>{
        const [x,z,width,depth,yaw]=path[index]
        return <ThresholdStoneAsset key={z} name={name}
          position={[x,-.06,z]} scale={[width/nominalWidth,1,depth/nominalDepth]} rotation={yaw}/>
      })}
    </ThresholdStoneBoundary>
    <mesh geometry={banks} material={bankMaterial} receiveShadow/>
  </group>
}
