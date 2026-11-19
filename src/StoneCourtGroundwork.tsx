import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MathUtils, MeshStandardMaterial, type ShaderMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { cutStone } from './assets/cutStone'
import { GATE } from './gardenLayout'
import { gateRoute } from './CaveGateStone'
import { folioWorldToMap } from './finaleLayout'

// The top ledges lie outside the play surface. Their toes continue below the
// water level, so the arcade and the gate are seated in the same excavation.
type Ledge = readonly [x: number, z: number, top: number, width: number, length: number, tilt: number]
const ledges: Ledge[] = [
  [-10.8, 5.6, .72, 3.2, 7.2, -.22], [10.1, 5.1, .60, 2.8, 6.8, .12],
  [-12.16,-6.8, 1.0, 2.55, 8.1, .12], [11.87,-6.6,.93,2.15,7.9,-.12],
  [-11.7,-19.4,6.2,3.75,4.4,.23],
  [10.5,-20.6,7.0,3.9,4.9,.24],
]

function terraceRock([x,z,top,width,length,tilt]: Ledge, id: number) {
  const rows=24, sides=48, pos:number[]=[], rgb:number[]=[], indices:number[]=[]
  const slate = new Color('#364e43'), ochre = new Color('#958367'), wet = new Color('#283f35')
  const color = new Color()
  const bottom = -1.35
  for (let row=0; row<=rows; row++) {
    const t=row/rows
    for (let col=0; col<sides; col++) {
      const a=col/sides*Math.PI*2
      const angular=(v:number)=>Math.sign(v)*Math.pow(Math.abs(v),.69)
      // The large beds dip toward the ravine; two narrow ribs break each
      // exposed edge, and a vertical joint offsets the bedding across it.
      const joint=Math.tanh(5*Math.sin(3*a+id*.94))
      const seam=t*(18+2*Math.sin(id*.5))+2.3*Math.sin(a-.6)+.28*joint
      const bed=Math.atan(3*Math.sin(seam))/1.25
      const split=Math.pow(.5+.5*Math.sin(7*a-1.7*t+id*1.7),9)
      const shoulder=.085*Math.sin(5*a+id)+.055*Math.sin(9*a+2.7*t)
      const ripple=.022*Math.sin(seam*3+.8*Math.cos(a*5))
      const shards=.022*Math.sin(a*21+t*15)*Math.sin(a*5-t*4)
      const taper=(row===rows?.80:row===0?.94:1)
      const lip=(1-.16*t+.081*bed+shoulder-.08*split+ripple+shards)*taper
      const lx=width*angular(Math.cos(a))*lip, lz=length*angular(Math.sin(a))*lip
      const lift=(.38*Math.sin(a*2+.35*id)+.065*Math.sin(6*a))*Math.sin(t*Math.PI*.55)
      const height=bottom+(top-bottom)*t+lift+Math.min(.09,(top-bottom)*.048)*Math.sin(a*13+t*11)
      pos.push(x+lx*Math.cos(tilt)-lz*Math.sin(tilt)+.4*t,height,z+lx*Math.sin(tilt)+lz*Math.cos(tilt))
      color.copy(slate).lerp(ochre,.06+.33*t+.12*Math.max(0,Math.cos(seam)))
      color.multiplyScalar(.9+.08*Math.sin(a*10+t*27)+.14*bed-.18*split)
      if(height<.22)color.lerp(wet,Math.min(1,(.22-height)*1.45))
      rgb.push(color.r,color.g,color.b)
      if (row) {
        const k=row*sides+col, next=row*sides+(col+1)%sides
        indices.push(k-sides,k,next,k-sides,next,next-sides)
      }
    }
  }
  const cap=pos.length/3
  pos.push(x+.4,top+.1,z);rgb.push(.24,.29,.22)
  for(let col=0;col<sides;col++) indices.push(cap,rows*sides+(col+1)%sides,rows*sides+col)
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(pos,3))
  geometry.setAttribute('color',new Float32BufferAttribute(rgb,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const sharp = geometry.toNonIndexed()
  const broadNormal = sharp.getAttribute('normal').clone()
  sharp.computeVertexNormals()
  const normal = sharp.getAttribute('normal')
  for(let i=0;i<normal.count;i++){
    const mix=.20+.27*(1-Math.abs(normal.getY(i)))
    normal.setXYZ(i,
      broadNormal.getX(i)*(1-mix)+normal.getX(i)*mix,
      broadNormal.getY(i)*(1-mix)+normal.getY(i)*mix,
      broadNormal.getZ(i)*(1-mix)+normal.getZ(i)*mix)
  }
  geometry.dispose()
  return sharp
}

function merged(parts: BufferGeometry[]) {
  const result=mergeGeometries(parts)
  parts.forEach(part=>part.dispose())
  return result
}

function foundations() {
  const parts: BufferGeometry[]=[]
  const block=(x:number,y:number,z:number,w:number,h:number,d:number, r=0)=>{
    parts.push(cutStone(w,h,d,.055).rotateY(r).translate(x,y,z))
  }
  // Gate sill and fully backed stair flight. The top follows the original
  // steps and passage corridor, keeping doors and ball clearance intact.
  for (let course=0;course<3;course++) {
    const y=-.91+course*.49, z=-16.85+course*.10
    for (let bay=0;bay<6;bay++) block(GATE.x+(bay-2.5)*1.19,y,z,1.174,.484,3.9-course*.30)
  }
  block(GATE.x,.615,GATE.z,5.78,.31,2.58)
  // Lock the landing into both excavated rock shoulders. Buttress courses
  // stop on either side of the playable stair treads and the door pocket.
  for (const side of [-1,1]) {
    for (let course=0;course<3;course++) {
      for(let bay=0;bay<3;bay++){
        const x=GATE.x+side*(3.29+bay*.74+course*.058)
        block(x,-.65+course*.39,-16.08-bay*.54,.73,.38,2.05+bay*.24,-side*.082)
      }
    }
    block(GATE.x+side*3.21,.686,-16.49,.72,.27,1.88,-side*.12)
  }
  gateRoute.slice(0,-1).forEach(([x,y,z],i)=>{
    const bottom=-.68
    const masonryTop=y-.11
    block(x,(masonryTop+bottom)*.5,z,5.97-i*.093,masonryTop-bottom,1.12,-.025*i)
    for(const side of [-1,1])block(x+side*(2.61-i*.05),y-.035,z, .51,.32,1.02,-.025*i)
  })
  // Visible squared piers tying both galleries into the same bedrock.
  for(const side of [-1,1]){
    const x=side>0?10.70:-12.55
    const center=side>0?-2.6:-4.9
    for(let i=0;i<16;i++)block(x,-.42,center-12.15+i*1.62,2.77,.72,1.599)
  }
  return merged(parts)
}

const basinSurface = .04
type Course = readonly [x: number, y: number, z: number]
type Ravine = { width: number; fallWidth: number; courses: readonly Course[] }

// The headwater, ledges, and plunge pools share this cross-section.
// Each near-vertical pair is a scarp; the shallower pairs are exposed beds.
const ravines: readonly Ravine[] = [
  { width: 5.0, fallWidth: 1.06, courses: [
    [-8.1,5.12,-17.25],[-8.35,5.08,-15.48],[-8.5,4.86,-15.13],
    [-8.53,3.94,-14.76],[-8.9,3.88,-13.14],[-8.93,3.80,-12.85],
    [-9.25,2.10,-12.30],[-9.48,1.78,-11.22],[-9.63,1.64,-10.97],
    [-9.66,.04,-9.94],
  ] },
  { width: 4.68, fallWidth: .94, courses: [
    [7.2,3.76,-16.6],[7.65,3.58,-14.4],[7.8,3.41,-14.15],
    [8.36,3.37,-13.45],[8.58,1.93,-11.95],[8.72,1.61,-11.7],
    [8.86,.55,-11.23],[9.15,.46,-10.63],[9.42,.04,-9.6],
  ] },
  { width: 1.7, fallWidth: .78, courses: [
    [9.98,1.64,-5.22],[9.70,1.64,-4.81],[9.55,1.56,-4.60],
    [9.33,.83,-4.26],[9.18,.76,-3.95],[9.05,.71,-3.81],
    [8.87,.04,-3.31],
  ] },
]

function bankPoint(course: Course, u: number, row: number, side: number, width: number) {
  const [x,y,z] = course
  // The channel is downcut into its own bed. Strata retain their asymmetry
  // across the width, but the lip under each water ribbon follows the same bed.
  const eroded = Math.exp(-34*u*u)
  const fractured = .18*Math.sin(u*19+row*.63) + .08*Math.sin(u*41-row*.41)
  const shoulder = Math.max(0,1-Math.abs(u))*Math.min(1,y*.8)*(.12+.65*Math.abs(u))
  const inward = u*side < 0 ? 1-.51*MathUtils.smoothstep(Math.abs(u),.14,.8) : 1
  return [
    x + u * width * inward * (1 + .09*Math.cos(row*.86+side) + .04*Math.sin(u*12)),
    y + (fractured+shoulder)*(1-eroded),
    z + (.31*Math.sin(u*8+row*.3)+.14*Math.sin(u*27+row*.85))*(1-eroded),
  ] as const
}

function quarriedBank({ width, courses }: Ravine) {
  const columns=40, vertices:number[]=[], rgb:number[]=[], indices:number[]=[]
  const moss=new Color('#466454'), stone=new Color('#394e42'), vein=new Color('#a69a71')
  const color=new Color(), side=Math.sign(courses[0][0])
  const last=courses.at(-1)!
  const terrace=[...courses,[last[0],-.95,last[2]+.6] as const]
  for (const [row, course] of terrace.entries()) {
    for(let col=0;col<=columns;col++){
      const u=(col/columns-.5)*2
      vertices.push(...bankPoint(course,u,row,side,width))
      const bedding = .5+.5*Math.sin(u*19+row*.74)
      const wet = Math.exp(-24*u*u)
      color.copy(stone).lerp(moss,.18+.32*bedding).lerp(vein,(.08+.16*bedding)*(1-wet))
      color.multiplyScalar(.86+.18*Math.sin(u*8+side)+.11*Math.cos(u*27-row))
      rgb.push(color.r,color.g,color.b)
      if(row&&col){
        const k=row*(columns+1)+col, a=k-columns-2
        indices.push(a,a+1,k,a,k,k-1)
      }
    }
  }
  const g=new BufferGeometry()
  g.setAttribute('position',new Float32BufferAttribute(vertices,3))
  g.setAttribute('color',new Float32BufferAttribute(rgb,3))
  g.setIndex(indices)
  g.computeVertexNormals()
  const surface=g.toNonIndexed()
  g.dispose()
  return surface
}

function buildWaterfall({courses,fallWidth:width,width:bankWidth}:Ravine) {
  const pos:number[]=[], uv:number[]=[], ix:number[]=[]
  const cols=10, subdivisions=6, rows=(courses.length-1)*subdivisions
  const side=Math.sign(courses[0][0])
  const [x,,z]=courses.at(-1)!
  let distance=0
  for(let j=0;j<=rows;j++){
    const segment=Math.min(courses.length-2,Math.floor(j/subdivisions))
    const t=(j-segment*subdivisions)/subdivisions
    for(let i=0;i<=cols;i++){
      const u=i/cols, cross=(u-.5)*width/bankWidth
      const from=bankPoint(courses[segment],cross,segment,side,bankWidth)
      const to=bankPoint(courses[segment+1],cross,segment+1,side,bankWidth)
      const zAdvance = MathUtils.lerp(from[2],to[2],t)
      pos.push(MathUtils.lerp(from[0],to[0],t),MathUtils.lerp(from[1],to[1],t)+.025,zAdvance+.085)
      uv.push(u,distance)
      if(j&&i){const k=j*(cols+1)+i;ix.push(k-cols-2,k-1,k,k-cols-2,k,k-cols-1)}
    }
    const start=courses[segment], end=courses[segment+1]
    distance+=Math.hypot(end[1]-start[1],end[2]-start[2])/subdivisions
  }
  // The last row meets a low fan above the reflecting channel. Its outer
  // ripples are stretched downstream and fade into the existing water.
  const fan=pos.length/3
  const steps=40
  for(let r=0;r<=8;r++)for(let i=0;i<=steps;i++){
    const theta=i/steps*2*Math.PI, s=r/8
    const spread=width*(1+.084*Math.cos(theta*7)+.041*Math.sin(theta*11))
    const dx=Math.cos(theta)*s, dz=Math.sin(theta)*s
    pos.push(x+dx*spread*.94,basinSurface+.016+.011*(1-s),z+.11+dz*spread*1.4+.32*s)
    uv.push(.5+dx*.5,-1.5+dz*.45)
    if(r&&i){const k=fan+r*(steps+1)+i;ix.push(k-steps-2,k,k-1,k-steps-2,k-steps-1,k)}
  }
  const g=new BufferGeometry()
  g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(ix)
  return g
}

const waterVertex='varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}'
const waterFragment=`
varying vec2 st;uniform float time;
void main(){
  if(st.y<0.){
    vec2 delta=vec2(2.*st.x-1.,(st.y+1.5)/.45);
    float angle=atan(delta.y,delta.x);
    float radius=length(delta);
    float wave=.5+.5*sin(radius*36.-time*5.+.8*sin(angle*7.));
    float broken=.6+.4*sin(angle*17.+radius*24.+.7*sin(angle*4.));
    float rings=pow(wave,9.)*broken*smoothstep(.11,.33,radius);
    float core=(1.-smoothstep(.09,.55,radius))*(.55+.23*sin(time*9.+delta.x*31.+delta.y*13.));
    float plume=(core+.55*rings)*(1.-smoothstep(.64,.99,radius));
    gl_FragColor=vec4(mix(vec3(.16,.35,.28),vec3(.69,.76,.61),.37+core*.53),plume*.57);
  }else{
  float strands=sin(15.*st.x+.7*sin(st.y*2.2));
  float slip=sin(st.y*7.-time*6.5+st.x*9.+strands*.65);
  float phase=st.x*33.+slip*.42;
  float hair=mix(pow(.5+.5*sin(phase),3.5),.28,smoothstep(.32,1.2,fwidth(phase)));
  float toes=smoothstep(.2,1.4,st.y);
  float edge=smoothstep(.0,.16,st.x)*smoothstep(.0,.17,1.-st.x);
  float gather=.30+.25*hair+.09*slip+.27*toes;
  vec3 color=mix(vec3(.065,.178,.17),vec3(.77,.83,.73),.29+hair*.31+toes*.26);
  gl_FragColor=vec4(color,edge*gather);
  }
  #include <colorspace_fragment>
}`

export function makeStratifiedCourtStone(tint: string, vertexColors=false) {
  const material = new MeshStandardMaterial({ color:tint, vertexColors, roughness:.86 })
  material.onBeforeCompile=shader=>{
    shader.uniforms.folioWorldToMap = folioWorldToMap
    shader.vertexShader='uniform mat4 folioWorldToMap; varying vec3 strata;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nstrata=(folioWorldToMap*(modelMatrix*vec4(position,1.))).xyz;')
    shader.fragmentShader='varying vec3 strata;\n'+shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 along=vec2(strata.x+strata.z*.41,strata.y+.16*strata.z-.11*strata.x);
      float layers=sin(12.*along.y+2.7*sin(.6*along.x)+.9*sin(3.2*along.x+along.y));
      float fissure=pow(max(layers,0.),8.);
      float flakes=sin(dot(along,vec2(31.,27.))+.7*sin(strata.z*52.))*sin(along.y*41.-along.x*22.);
      float small=sin(dot(strata,vec3(96.,47.,79.)))*sin(dot(strata,vec3(39.,81.,26.)));
      float seam=fissure*(.5+.5*sin(along.x*5.3+layers));
      float contour=.5+.5*sin(along.x*.83+along.y*1.31);
      float detail=.047*flakes+.018*small-.16*seam;
      diffuseColor.rgb*=.91+.15*contour+detail;
      diffuseColor.rgb+=vec3(.041,.024,.009)*smoothstep(.75,1.,contour)*(1.-seam);
      `).replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      vec3 da=dFdx(vViewPosition), db=dFdy(vViewPosition);
      vec3 grade=cross(db,normal)*dFdx(detail)+cross(normal,da)*dFdy(detail);
      float det=dot(da,cross(db,normal));
      normal=normalize(normal-clamp(1./(det+.000001),-1.,1.)*grade*.14);
      `)
  }
  material.customProgramCacheKey=()=> 'courtyard-stratified-stone'
  return material
}

export default function StoneCourtGroundwork() {
  const rock=useMemo(()=>merged([...ledges.map(terraceRock), ...ravines.map(quarriedBank)]),[])
  const built=useMemo(foundations,[])
  const water=useMemo(()=>merged(ravines.map(buildWaterfall)),[])
  const natural=useMemo(()=>makeStratifiedCourtStone('#dae3d1',true),[])
  const masonry=useMemo(()=>makeStratifiedCourtStone('#827658'),[])
  const flow=useRef<ShaderMaterial>(null)
  const uniforms=useMemo(()=>({time:{value:0}}),[])
  useFrame((_,delta)=>{if(flow.current)flow.current.uniforms.time.value+=Math.min(delta,.05)})
  useEffect(()=>()=>{rock.dispose();built.dispose();water.dispose();natural.dispose();masonry.dispose()},[rock,built,water,natural,masonry])
  natural.side=DoubleSide
  return <group name="Rock-founded stone court and cascades">
    <mesh geometry={rock} material={natural} receiveShadow/>
    <mesh geometry={built} material={masonry} receiveShadow castShadow/>
    <mesh geometry={water} renderOrder={4} name="Cascades on stepped bedrock">
      <shaderMaterial ref={flow} uniforms={uniforms} vertexShader={waterVertex}
        fragmentShader={waterFragment} transparent depthWrite={false} side={DoubleSide}/>
    </mesh>
  </group>
}
