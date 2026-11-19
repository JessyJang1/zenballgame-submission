import {BufferGeometry} from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {cutStone} from './cutStone.ts'

export function courses(){
  const pieces:BufferGeometry[]=[]
  function block(x:number,y:number,z:number,w:number,h:number,d:number,bevel=.03){
    pieces.push(cutStone(w,h,d,bevel).translate(x,y,z))
  }
  // The gallery floor continues through the arch; the stairs descend into
  // the spring from two landings on the court-facing edge.
  for(let tier=0;tier<3;tier++)for(let column=0;column<20;column++){
    const x=-12.35+1.3*column
    const z=.56 + (tier===1?.044:0)
    block(x,.11+tier*.425,z,1.288,.413,3.40,.028)
  }
  for(let column=0;column<20;column++)block(-12.35+1.3*column,1.26,.48,1.291,.18,5.56)

  for(let bay=0;bay<=5;bay++){
    const x=-13+5.2*bay
    block(x,1.58,-.12,1.19,.42,1.50)
    block(x,1.87,-.12,1.06,.16,1.39)
    for(let course=0;course<4;course++){
      const span=.88+course*.024
      block(x,2.03+course*.205,-.12,span,.193,1.28,.021)
    }
    block(x,2.88,-.12,1.25,.22,1.55)
    block(x,3.035,-.12,1.04,.12,1.39,.018)
    block(x,6.64,.22,.31,.80,.45)
    // Side returns roof the long gallery recess; the square porch ends
    // remain behind the carved face in the court camera.
    block(x,2.63,2.61,.92,2.61,2.84,.042)
    block(x,4.34,2.28,1.12,.65,2.92,.046)
  }
  for(const x of [-7.8,7.8])for(let i=0;i<5;i++){
    const top=1.36-(i+1)*.225
    for(let tread=0;tread<3;tread++){
      block(x+(tread-1)*1.216,(top-.22)/2,-1.38-i*.31,1.209,top+.22,.43)
    }
  }
  const g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose())
  // Preserve texel density around nosings and across the long platform faces.
  const pos=g.getAttribute('position'),n=g.getAttribute('normal'),uv=g.getAttribute('uv')
  for(let i=0;i<pos.count;i++){
    const flank=Math.abs(n.getX(i))>.5, horizontal=Math.abs(n.getY(i))>.5
    uv.setXY(i,(flank?pos.getZ(i):pos.getX(i))*.95,(horizontal?pos.getZ(i):pos.getY(i))*1.24)
  }
  return g
}
