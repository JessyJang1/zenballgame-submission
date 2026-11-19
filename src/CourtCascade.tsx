import { useEffect,useMemo,useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, type Texture } from 'three'
import { makeCaveStone } from './assets/caveStone'

// Shelves carry the tree roots above the pool. Farther upstream the same bed
// rises in faulted terraces. Each fall is rooted at the forward lip of a shelf.
const falls=[[-9.45,3.45,-9.26,.96],[10.27,1.9,-4.75,.87],[-8.92,1.43,-9.14,.53]] as const
const shelves=[
  [-8.65,6.8,1.36,.61,1.09],[11.1,5.85,1.48,.54,1.13],
  [-9.5,-12.05,3.36,4.03,2.65],[10.1,-6.7,2.15,2.35,2.04],
  [-10.6,-16.1,3.42,6.7,3.2],[9.2,-17.2,3.7,4.9,3.8],
  [-6.9,-13.6,2.0,2.34,2.4],[6.6,-14.8,1.8,2.7,2.38],
  [8.4,7.9,1.3,1.28,1.7],[-9.2,8.1,1.25,1.1,1.41],
]
// Irregular plan and ledge profiles cut from the silhouette of the card's
// rock gardens. The corners break along inclined joints, not round tiers.
const plan=[[-1,.32],[-.92,-.38],[-.66,-.78],[-.19,-.92],[.27,-.76],
  [.75,-.83],[.98,-.34],[.82,.09],[.95,.54],[.51,.84],[.02,.92],[-.54,.75]] as const
const layers=[
  [0,1,0],[.19,1.05,-.03],[.28,.91,.043],
  [.48,.88,.07],[.53,.73,.11],[.76,.68,.045],
  [.81,.59,.12],[.95,.49,.15],[1,.44,.16]
] as const
function outcrops(){
  const p:number[]=[],colors:number[]=[],ix:number[]=[]
  const deep=new Color('#344c44'),jade=new Color('#596d58'),edge=new Color('#927d54'),tint=new Color()
  const count=plan.length
  shelves.forEach(([x,z,w,h,d],n)=>{
    const start=p.length/3
    const turn=[.15,-.32,-.17,.24,.14,-.2,.47,-.47,.18,-.28][n]
    for(const [j,[v,breadth,drift]] of layers.entries())for(const [i,[px,pz]] of plan.entries()){
      const joint=1+.16*Math.cos(i*2.81+n)+.08*Math.sin(i*3.2+j)
      const sx=px*Math.cos(turn)-pz*Math.sin(turn),sz=px*Math.sin(turn)+pz*Math.cos(turn)
      p.push(x+w*(sx*breadth*joint+drift),-.36+h*(v+.069*px-.074*pz+.057*Math.sin(i*2.9+n)*v),
        z+d*(sz*breadth*joint+.12*v))
      tint.copy(deep).lerp(jade,.27+.24*Math.cos(i*1.19+n)+.19*v)
      if(j===2||j===4||j===6||j===8)tint.lerp(edge,.18+.19*Math.sin(i*2.2+n)**2)
      colors.push(tint.r,tint.g,tint.b)
      const k=start+j*count+i,next=start+j*count+(i+1)%count
      if(j)ix.push(k-count,k,next-count,next-count,k,next)
    }
    const cap=start+(layers.length-1)*count
    for(let i=1;i<count-1;i++)ix.push(cap,cap+i+1,cap+i)
  })
  const hull=new BufferGeometry()
  hull.setAttribute('position',new Float32BufferAttribute(p,3))
  hull.setAttribute('color',new Float32BufferAttribute(colors,3));hull.setIndex(ix)
  // Smooth the minor triangulation within each stone face while keeping the
  // broad bedding steps angular in silhouette.
  hull.computeVertexNormals()
  const broad=hull.getAttribute('normal')
  const cut=hull.toNonIndexed()
  hull.dispose();cut.computeVertexNormals()
  const surface=cut.getAttribute('normal')
  for(const [i,index] of ix.entries()){
    const x=surface.getX(i),y=surface.getY(i),z=surface.getZ(i)
    const a=broad.getX(index),b=broad.getY(index),c=broad.getZ(index)
    const smooth=x*a+y*b+z*c>.52?.69:.16
    surface.setXYZ(i,x+(a-x)*smooth,y+(b-y)*smooth,z+(c-z)*smooth)
  }
  return cut
}
export default function CourtCascade({atlas}:{atlas:Texture}){
  const geometry=useMemo(outcrops,[]),cliff=useMemo(()=>{const m=makeCaveStone(atlas,'ridge','#d5cbac');m.vertexColors=true;m.emissive.set('#32443b');m.emissiveIntensity=.28;return m},[atlas])
  const time=useRef({value:0})
  useFrame((_,dt)=>{time.current.value+=Math.min(.08,dt)})
  useEffect(()=>()=>{geometry.dispose();cliff.dispose()},[geometry,cliff])
  return <group name="Court spring and rock islands">
    <mesh geometry={geometry} material={cliff} receiveShadow castShadow/>
    {falls.map(([x,h,z,w])=><mesh key={x} position={[x,h/2,z]} rotation-x={-.12}>
      <planeGeometry args={[w,h]}/>
      <shaderMaterial transparent depthWrite={false} side={DoubleSide} uniforms={{clock:time.current}}
        vertexShader="varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
        fragmentShader={`varying vec2 st;uniform float clock;void main(){
          float x=st.x+.026*sin(st.y*13.+clock*2.);
          float edge=smoothstep(0.,.15,x)*(1.-smoothstep(.84,1.,x));
          float threads=sin(x*76.+sin(x*11.)*5.+st.y*5.);
          float spray=.5+.5*sin(st.y*32.+clock*6.+x*18.);
          float a=edge*(.26+.31*threads*threads+.21*spray)*(1.-smoothstep(.87,1.,st.y));
          gl_FragColor=vec4(mix(vec3(.37,.52,.47),vec3(.91,.88,.72),spray*.65),a);
          #include <colorspace_fragment>
        }`}/>
    </mesh>)}
    {falls.map(([x,,z,w])=><mesh key={x} position={[x,.056,z+.29]} rotation-x={-Math.PI/2}>
      <planeGeometry args={[w*2.9,w*2.9]}/>
      <shaderMaterial transparent depthWrite={false} uniforms={{clock:time.current}}
        vertexShader="varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
        fragmentShader={`varying vec2 st;uniform float clock;void main(){
          vec2 p=(st-.5)*vec2(1.,1.6);
          float r=length(p);
          float wave=pow(.5+.5*sin(r*67.-clock*9.),5.);
          float fade=1.-smoothstep(.10,.49,r);
          gl_FragColor=vec4(.8,.84,.68,fade*(.13*wave+.24*exp(-r*22.)));
          #include <colorspace_fragment>
        }`}/>
    </mesh>)}
  </group>
}
