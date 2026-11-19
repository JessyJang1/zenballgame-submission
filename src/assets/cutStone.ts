import { BufferGeometry, ExtrudeGeometry, Shape } from 'three'

const stoneTemplates = new Map<string, BufferGeometry>()

// Dimensions describe the outside faces. The bevel stays within the block
// so neighbouring stones keep their designed mortar gap.
export function cutStone(width:number,height:number,depth:number,bevel:number){
  const key = [width,height,depth,bevel].join('/')
  const existing = stoneTemplates.get(key)
  if (existing) return new BufferGeometry().copy(existing)
  const x=width/2-bevel,y=height/2-bevel
  const face=new Shape()
  face.moveTo(-x,-y);face.lineTo(x,-y);face.lineTo(x,y);face.lineTo(-x,y);face.closePath()
  const geometry = new ExtrudeGeometry(face,{
    depth:depth-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,steps:1,
  }).translate(0,0,-depth/2+bevel)
  if (stoneTemplates.size >= 48) stoneTemplates.delete(stoneTemplates.keys().next().value!)
  stoneTemplates.set(key,geometry)
  return new BufferGeometry().copy(geometry)
}
