import {BufferGeometry,Color,Float32BufferAttribute,MathUtils} from 'three'
import {CLOUD_TERRACE,GATE_WALK} from '../paintingLayout.ts'
// A limestone spur outside the playable terraces. One cross-section supplies
// both the walk and the ledge it was cut into, so the way never floats.
// Centre lines measured against the gameplay camera. The first ledge
// rises outside the gate walk, the last terrace sits beyond the summit.

// The gate ramp lands on the south edge of the cloud court. The lower
// traverse shares that landing, rounds the east bank, then doubles back.
const bends=[
  [GATE_WALK.x,CLOUD_TERRACE.y,GATE_WALK.endZ],
  [3.4,4.84,-26.5],[6.9,5.5,-30],[9.25,6.48,-35.6],
  [9.85,7.62,-41.8],[8.95,7.68,-44.1],[5.35,9.04,-47.85],
  [4.6,10.12,-51.4],[5.1,10.18,-53.4],[10.25,12.16,-58.5],
  [12,13.10,-62.2],[11.85,13.16,-64.55],[7.30,14.63,-69.6],
  [5.2,15.2,-74],[5.2,15.2,-78]
] as const

const ease = MathUtils.smoothstep
function station(t:number) {
  const i=Math.min(bends.length-2,Math.floor(t)), f=t-i, a=bends[i], b=bends[i+1]
  const landing = Math.abs(b[1]-a[1]) < .12
  const blend = f*f*(3-2*f)
  const z=MathUtils.lerp(a[2],b[2],f)
  const dx=(b[0]-a[0])*6*f*(1-f)
  const dz=b[2]-a[2]
  const length=Math.hypot(dx,dz)
  return {x:MathUtils.lerp(a[0],b[0],blend), y:MathUtils.lerp(a[1],b[1],f), z,
    nx:-dz/length, nz:dx/length,
    width:.86+.12*Math.sin(z*.33)+.09*Math.cos(z*.71)+.46*(landing?Math.sin(Math.PI*f):0)}
}

// A flight climbs to a broad bench, turns, then climbs across the next bed.
// Cut the noses transverse to travel; sink their heels into the uphill wall.
export function cutStoneTrail() {
  const positions:number[]=[],indices:number[]=[],colors:number[]=[]
  const tint=new Color()
  for(let segment=0;segment<bends.length-1;segment++){
    const rise=bends[segment+1][1]-bends[segment][1]
    const rows=Math.max(1,Math.ceil(rise/(.31+.055*Math.sin(segment))))
    for(let row=0;row<rows;row++){
      const n=station(segment+row/rows), f=station(segment+(row+1)/rows)
      const top=f.y+.095, id=segment*17+row
      const outline=[[-.88,0],[.72,0],[1,.11],[1,.90],[.84,1],[-.95,1],[-1,.83],[-1,.15]]
      const base=positions.length/3
      for(let layer=0;layer<2;layer++){
        for(const [side,depth] of outline){
          const width=MathUtils.lerp(n.width,f.width,depth) * (1+.095*Math.sin(id*3.4+side))
          const x=MathUtils.lerp(n.x,f.x,depth)+side*width*MathUtils.lerp(n.nx,f.nx,depth)
          const z=MathUtils.lerp(n.z,f.z,depth)+side*width*MathUtils.lerp(n.nz,f.nz,depth)
          const y=layer===0 ? top+.022*side : n.y-.19
          positions.push(x,y,z)
          tint.set(layer===0?'#cabe9c':'#82775f').multiplyScalar(.93+.06*Math.cos(id*2.6+side*.45))
          colors.push(tint.r,tint.g,tint.b)
        }
      }
      const count=outline.length
      for(let j=1;j<count-1;j++)indices.push(base,base+j,base+j+1)
      for(let j=0;j<count;j++){
        const k=(j+1)%count
        indices.push(base+j,base+j+count,base+k,base+k,base+j+count,base+k+count)
      }
    }
  }
  const mesh = new BufferGeometry()
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3))
  mesh.setAttribute('color',new Float32BufferAttribute(colors,3))
  mesh.setIndex(indices); mesh.computeVertexNormals()
  return mesh
}

export function buildPass(){
  const positions:number[]=[],colors:number[]=[],indices:number[]=[]
  const moss=new Color('#39524a'),stone=new Color('#aa9972'),shadow=new Color('#334742'),tint=new Color()
  const rows=168, cols=86
  for(let row=0;row<=rows;row++){
    const t=row/rows*(bends.length-1)
    const {x,y,z,width:trailWidth,nx}=station(t)
    const at=(center:number,radius:number)=>1-ease(Math.abs(z-center),0,radius)
    const lower=ease(t,0,2.4)
    // Leave the playable cloud terrace clear. Two projecting lips grow from
    // its far escarpment and interrupt the distant flights in perspective.
    const prow=at(-47.8,2.65)*1.35+at(-62.5,2.8)*1.58
    // The 6.9 m gate rests on a broad summit landing, including its rotated feet.
    const gateLanding=ease(-z,69,74)
    const seat=trailWidth/Math.max(.56,nx)+3.25*gateLanding
    for(let col=0;col<=cols;col++){
      const u=(col-cols/2)/(cols/2), dist=Math.abs(u), side=Math.sign(u)
      const margin=Math.max(0,(dist-.16)/.84)
      const span=side<0 ? 2.0+lower*(2.9+.85*Math.sin(z*.23)) : 2.4+lower*(5.7+1.3*Math.sin(z*.2))
      const offset=side*(dist<=.16?dist/.16*seat:seat+margin*span), wx=x+offset
      const outward=Math.max(0,Math.abs(offset)-seat)
      const strike=z*.38+wx*.55+.62*Math.sin(z*.37)
      const seam=.5+.5*Math.sin(strike)
      const rock=1-ease(margin,.63,1)
      const wall=side>0 ? (.36+lower*(.72+1.35*at(-56,5)+1.22*at(-68,4))) : prow
      // A cut wall on the high side and a projecting nose on the low side
      // share the tread's cross-section, including at the turning platforms.
      let h=y-.17+.17*gateLanding+(wall*ease(outward,0,.86)+.21*seam*ease(outward,.18,1.05))*rock*(1-gateLanding)
      h-=(1.6+lower*13)*( .47*margin+.17*ease(margin,.17,.27)+.22*ease(margin,.45,.56)+.14*ease(margin,.72,.86) )
      h+=ease(outward,.25,1)*(.23*Math.sin(strike*2.1)+.12*Math.cos(z*1.08+wx))
      positions.push(wx,h,z)
      tint.copy(shadow).lerp(stone,.23+.36*seam+.10*Math.cos(h*3.1+z*.2)).lerp(moss,.26+.16*Math.sin(strike*.5))
      colors.push(tint.r,tint.g,tint.b)
      const k=row*(cols+1)+col
      if(row&&col)indices.push(k-cols-2,k-cols-1,k,k-cols-2,k,k-1)
    }
  }
  // Seal all four exposed escarpments down below the valley floor.
  const rim:number[]=[]
  for(let c=0;c<=cols;c++)rim.push(c)
  for(let r=1;r<=rows;r++)rim.push(r*(cols+1)+cols)
  for(let c=cols-1;c>=0;c--)rim.push(rows*(cols+1)+c)
  for(let r=rows-1;r>0;r--)rim.push(r*(cols+1))
  const foot=positions.length/3
  rim.forEach(k=>{positions.push(positions[k*3],-9,positions[k*3+2]);colors.push(shadow.r,shadow.g,shadow.b)})
  rim.forEach((k,i)=>{const j=(i+1)%rim.length;indices.push(k,foot+i,rim[j],rim[j],foot+i,foot+j)})
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3))
  g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g
}
