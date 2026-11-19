import { courtRidges } from './courtRidgeGeometry.ts'
import { makeBark, makeNeedles } from './pineGeometry.ts'
import { buildPass, cutStoneTrail } from './passGeometry.ts'
import { nearRange, farRange } from './summitRangeGeometry.ts'
import { courses } from './cloisterGeometry.ts'
import { BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, MathUtils, Shape, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { STONE_PROLOGUE } from '../stonePrologueLayout.ts'

// An annular limestone vault with two axial openings. The actual sky is visible
// through the crown as well as through the gate end of the hall.
function roof() {
  const around=192, across=42, p:number[]=[], indices:number[]=[]
  for(let j=0;j<=across;j++)for(let i=0;i<=around;i++){
    const a=2*Math.PI*i/around,t=j/across
    const axial=Math.pow(Math.abs(Math.sin(a)),2.45)
    const far=Math.max(0,-Math.sin(a))
    const shoulder=far**2 * MathUtils.smoothstep(Math.cos(a),.18,.77)
    const foot=-2+axial*(Math.sin(a)>0?17:18.2)-shoulder*2.7
    const fissure=.58*Math.sin(7*a+.5)+.33*Math.sin(13*a-t*3)
    const bed = 21*t+3.2*Math.sin(2*a+.43)+1.2*Math.sin(8*a+5*t)
    const bedding = Math.pow(.5+.5*Math.sin(bed),5)
    const joints = Math.sin(18*a+t*7)*Math.sin(39*a-t*12)
    const reach=1-.59*t*t+.035*fissure+.020*bedding+.008*joints
    const y=foot+(20.5+4*axial-foot)*Math.sin(t*Math.PI*.48)+1.6*Math.sin(3*a-.43)*t+.48*fissure
    const lip=Math.max(0,-Math.sin(a))**3*(1-t)**2
    const chipped=lip*(.64*Math.sin(18*a)+.34*Math.sin(36*a+t*8))
      +.38*Math.sin(23*a-16*t)*Math.sin(9*a+4*t)*far
    p.push(20*Math.cos(a)*reach+1.7*t,y+chipped+.55*bedding+.21*joints,-4+29*Math.sin(a)*reach)
    if(i&&j){const k=j*(around+1)+i;indices.push(k-1,k-around-2,k,k,k-around-2,k-around-1)}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setIndex(indices);g.computeVertexNormals();return g
}

// Continuous side galleries cut through a thick stone wall. Light and the
// water outside can be seen through each arch from the playing surface.
function arcade(){
  const s=new Shape(), floor=-1.2, spring=2.7, span=5.2
  s.moveTo(-13,floor)
  for(let i=0;i<5;i++){
    const x=-13+i*span
    s.lineTo(x+.49,floor);s.lineTo(x+.49,spring)
    s.absarc(x+2.6,spring,2.11,Math.PI,0,true)
    s.lineTo(x+4.71,floor)
  }
  s.lineTo(13,floor);s.lineTo(13,6.1);s.lineTo(-13,6.1);s.closePath()
  return new ExtrudeGeometry(s,{depth:1.7,bevelEnabled:true,bevelThickness:.12,bevelSize:.12,bevelSegments:3,curveSegments:12})
}
function archStones(){
  const pieces:BufferGeometry[]=[]
  const palette=['#90917d','#797e70','#9b947e','#838976','#a69b83']
  function addStone(shape:Shape,depth:number,front:number,seed:number){
    const stone=new ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.023,bevelSize:.022,bevelSegments:1,curveSegments:8})
    const positions=stone.getAttribute('position'), normals=stone.getAttribute('normal')
    const colors:number[]=[],base=new Color(palette[seed%palette.length])
    for(let i=0;i<positions.count;i++){
      const recess=MathUtils.smoothstep(positions.getZ(i),0,1.3)
      const light=(.91-.46*recess)*(1+.11*normals.getY(i))
      colors.push(base.r*light,base.g*light,base.b*light)
    }
    stone.setAttribute('color',new Float32BufferAttribute(colors,3))
    pieces.push(stone.translate(0,0,front))
  }
  for(let bay=0;bay<5;bay++){
    const cx=-10.4+bay*5.2
    for(let block=0;block<13;block++){
      const a=block*Math.PI/13+.009,b=(block+1)*Math.PI/13-.009
      const crown=block===6, r=1.96, outer=crown?2.59:2.48
      const s=new Shape()
      s.absarc(cx,2.7,r,a,b,false)
      s.absarc(cx,2.7,outer,b,a,true);s.closePath()
      addStone(s,1.96,crown?-.43:-.33,bay+3*block)
    }
    // The bottom of each ashlar follows the extrados of the arch below it.
    for(let row=0;row<5;row++){
      const low=2.82+row*.68,top=Math.min(6.07,low+.64)
      if(top<=low)continue
      const floor=(x:number)=>Math.max(low,2.7+Math.sqrt(Math.max(0,2.46**2-(x-cx)**2)))
      for(let col=-1;col<4;col++){
        const start=cx-2.6+col*1.30+(row%2)*.65
        const left=Math.max(cx-2.6,start)+.018,right=Math.min(cx+2.6,start+1.30)-.018
        if(right<=left)continue
        const s=new Shape(),outline=[]
        for(let n=0;n<=12;n++){
          const x=MathUtils.lerp(left,right,n/12)
          if(floor(x)<top-.04)outline.push([x,floor(x)])
        }
        if(outline.length<2)continue
        s.moveTo(outline[0][0],top)
        for(const [x,y] of outline)s.lineTo(x,y)
        s.lineTo(outline[outline.length-1][0],top);s.closePath()
        addStone(s,.18,-.22,bay*3+row*5+col+1)
      }
    }
  }
  const merged=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());return merged
}
type ProfilePoint = readonly [number, number, number]

// The inside silhouette runs from the wet left foot to the wet right foot.
// X and Y locate the artwork on the front. The third value sculpts its depth.
const aperture: readonly ProfilePoint[] = [
  [445,820,19.2],[506,698,19.4],[542,629,19.1],[558,571,18.7],
  [579,517,18.9],[600,457,18.3],[601,406,17.9],[616,353,18.4],
  [620,311,18.3],[596,276,18.7],[634,261,18.85],[687,253,18.6],
  [746,242,18.05],[796,239,18.2],[840,236,17.5],[872,229,18.55],
  [891,253,19.1],[896,309,19.6],[911,366,19.45],[917,421,19.85],
  [938,485,19.4],[947,555,19.9],[967,629,19.6],[1010,710,20.1],[1045,820,20.3],
]
const outside: readonly ProfilePoint[] = [
  [-40,820,15.9],[-41,691,15.7],[-41,579,15.9],[-45,465,16.0],
  [-45,365,16.9],[-43,266,17.1],[-36,213,17.5],[120,161,17.9],
  [242,148,18.0],[419,147,18.6],[478,109,18.7],[558,61,18.9],
  [666,33,18.6],[771,29,18.7],[888,31,18.6],[987,36,18.9],
  [1080,68,19.4],[1192,76,19.1],[1307,93,18.8],[1380,125,19.2],
  [1380,267,18.6],[1380,428,18.8],[1380,585,18.9],[1380,711,19.6],[1380,820,19.5],
] as const

function sculptThreshold() {
  const eye = new Vector3(...STONE_PROLOGUE.eye)
  const forward = new Vector3(...STONE_PROLOGUE.look).sub(eye).normalize()
  const up = new Vector3(0,-forward.z,forward.y)
  const fov = Math.tan(MathUtils.degToRad(STONE_PROLOGUE.fov*.5))
  const positions:number[] = [], uv:number[] = [], frontWeight:number[] = [], indices:number[] = []
  const recess:number[] = []
  const subdivisions=9
  const vertices=(aperture.length-1)*subdivisions+1
  const interpolate=(outline:readonly ProfilePoint[],j:number) => {
    const i=Math.min(outline.length-2,Math.floor(j/subdivisions)),t=j/subdivisions-i
    return outline[i].map((value,axis)=>MathUtils.lerp(value,outline[i+1][axis],t))
  }
  const addRing=(fn:(j:number)=>{position:Vector3;x:number;y:number;weight:number;depth:number})=>{
    for(let j=0;j<vertices;j++){
      const {position,x,y,weight,depth}=fn(j)
      recess.push(depth)
      positions.push(position.x,position.y,position.z)
      uv.push(MathUtils.clamp(x,1,1347)/1672,1-MathUtils.clamp(y,41,797)/941)
      frontWeight.push(weight)
    }
  }
  const project=(x:number,y:number,d:number)=>{
    const point=eye.clone().addScaledVector(forward,d).addScaledVector(up,(1-(y-40)/379)*fov*d)
    point.x+=((x-674)/379)*fov*d
    return point
  }
  // From the outside rim across the painted surface, to the inner lip. The resulting
  // innermost vertices are shared by the following cave wall rings.
  const radial=Array.from({length:23},(_,i)=>i/22)
  for (const q of radial) addRing(j=>{
    const edge=interpolate(outside,j), lip=interpolate(aperture,j)
    const x=MathUtils.lerp(edge[0],lip[0],q)
    const y=MathUtils.lerp(edge[1],lip[1],q)
    const along=j/subdivisions
    const ledge=Math.abs(Math.sin(along*1.76+q*3+.48*Math.sin(along)))**.7
    const d=MathUtils.lerp(edge[2],lip[2],q)-Math.sin(q*Math.PI)*(1.12+ledge*.84+.24*Math.cos(along*3.8-q*9))
    return {position:project(x,y,d),x,y,weight:MathUtils.lerp(1, MathUtils.lerp(.57,.67,MathUtils.smoothstep(j,vertices*.54,vertices*.69)),
      MathUtils.smoothstep(q,.83,1)),depth:0}
  })
  const stations=[0,.55,1.45,2.8,4.7,7.4,10.1,12.4]
  for(let section=1;section<stations.length;section++){
    const start=stations[section-1], end=stations[section]
    const slices=Math.ceil((end-start)/.30)
    for(let slice=1;slice<=slices;slice++) addRing(j=>{
      const fraction=slice/slices
      const depth=MathUtils.lerp(start,end,fraction)
      const row=section-2+fraction
      const [x,y,d]=interpolate(aperture,j)
      const side=Math.sin(j/((vertices-1)/Math.PI))
      const sideSign=j<vertices*.5 ? -1 : 1
      const bx=x+sideSign*depth*(1-side)*.58+Math.sin(j/subdivisions*1.29+row*.85)*1.7*depth
      const by=y+side*depth*.42+Math.sin(j/subdivisions*.87+row*.9)*depth*.61
      const right=MathUtils.smoothstep(j,vertices*.54,vertices*.69)
      const position=project(bx,by,d+depth)
      const bedLevel=position.y*.94+depth*.34+.24*Math.sin(depth*.85+position.y*.45)
      const split=Math.sin(bedLevel*4.3+.8*Math.sin(bedLevel*1.2))
      const reach=right*MathUtils.smoothstep(depth,0,1.2)*(1-MathUtils.smoothstep(depth,10.9,12.4))
      position.x-=reach*(.17*Math.tanh(split*2.4)+.09*Math.sin(bedLevel*1.76))
      return {position,x:x+right*depth*4,y:y+right*depth*.31,
        weight:MathUtils.lerp(Math.max(0,.39-depth*.19),.67*(1-MathUtils.smoothstep(depth,0,2.8)),right),depth}
    })
  }
  // The rear closes into the outer bedrock. No duplicate front cap or separate lintel.
  addRing(j=>{
    const [x,y,d]=interpolate(outside,j)
    return {position:project(x,y,d+12.55),x,y,weight:0,depth:12.55}
  })
  const rings=positions.length/3/vertices
  for(let r=0;r<rings;r++){
    const adjacent=(r+1)%rings
    for(let j=0;j<vertices-1;j++){
      const a=r*vertices+j,b=adjacent*vertices+j
      indices.push(a,a+1,b,a+1,b+1,b)
    }
  }
  // Both ends of the arch meet the bed below the stepping stones.
  for(const endpoint of [0,vertices-1]){
    for(let r=1;r<rings-1;r++){
      indices.push(endpoint,r*vertices+endpoint,(r+1)*vertices+endpoint)
    }
  }
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setAttribute('uv',new Float32BufferAttribute(uv,2))
  geometry.setAttribute('facade',new Float32BufferAttribute(frontWeight,1))
  geometry.setAttribute('recess',new Float32BufferAttribute(recess,1))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export const openingShapes = { roof, arcade, archStones, sculptThreshold, buildRidges: courtRidges,
  buildPass, cutStoneTrail, nearRange, farRange, courses, makeBark, makeNeedles, farNeedles: () => makeNeedles(true) }
export type OpeningShape = keyof typeof openingShapes
