import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three'
import { LOTUS, STONE_BELL } from './gardenLayout.ts'

// Low relief inlay only: all gameplay collision shapes remain unchanged.
export function buildBellWatercourse() {
    const spine=new CatmullRomCurve3([
      new Vector3(LOTUS.x,0,LOTUS.z),new Vector3(-4.85,0,-6.25),
      new Vector3(-3.25,0,-5.25),new Vector3(-1.2,0,-5.05),
      new Vector3(1.5,0,-5.65),new Vector3(4.15,0,-6.45),
      new Vector3(STONE_BELL.x,0,STONE_BELL.z),
    ])
    const positions:number[]=[],uv:number[]=[],indices:number[]=[]
    for(let i=0;i<=72;i++){
      const u=i/72, center=spine.getPointAt(u), tangent=spine.getTangentAt(u)
      const width=.255+.024*Math.sin(u*22)
      for(const edge of [-1,-.68,.68,1]){
        positions.push(center.x+edge*width*tangent.z,Math.abs(edge)>.9?.065:.025,center.z-edge*width*tangent.x)
        uv.push(u,edge)
      }
      if(i){const k=i*4;for(let j=0;j<3;j++)indices.push(k-4+j,k-3+j,k+j,k-3+j,k+1+j,k+j)}
    }
    // Lay a brass band around the terminal stone without adding a separate draw pass.
    const rimStart=positions.length/3
    for(let i=0;i<=56;i++){
      const a=i/56*Math.PI*2
      for(const edge of [-1,1]){
        const radius=.78+.042*edge
        positions.push(STONE_BELL.x+radius*Math.cos(a),.026,STONE_BELL.z+radius*Math.sin(a))
        uv.push(1.08,edge)
      }
      if(i){const k=rimStart+i*2;indices.push(k-2,k-1,k,k-1,k+1,k)}
    }
    const mesh=new BufferGeometry()
    mesh.setAttribute('position',new Float32BufferAttribute(positions,3))
    mesh.setAttribute('uv',new Float32BufferAttribute(uv,2))
    mesh.setIndex(indices)
    return mesh
}
