import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from 'three'
export default function LotusPetal({index}:{index:number}) {
  const geometry=useMemo(()=>{
    const n=20,m=8,positions:number[]=[],colors:number[]=[],indices:number[]=[]
    const cream=new Color('#ead1aa'),pink=new Color('#c78769')
    for(let j=0;j<=n;j++)for(let i=0;i<=m;i++) {
      const t=j/n,s=i/m*2-1
      const w=Math.sin(Math.PI*t)**.72*.32
      positions.push(s*w,.07+.14*Math.sin(Math.PI*t)+.27*t*t*t+.06*s*s,t*1.02)
      const c=cream.clone().lerp(pink,Math.abs(s)**5*.34+t*.12+(index%2)*.04)
      colors.push(c.r,c.g,c.b)
      if(i&&j){const a=j*(m+1)+i;indices.push(a,a-m-2,a-1,a,a-m-1,a-m-2)}
    }
    const mesh=new BufferGeometry();mesh.setAttribute('position',new Float32BufferAttribute(positions,3));mesh.setAttribute('color',new Float32BufferAttribute(colors,3));mesh.setIndex(indices);mesh.computeVertexNormals();return mesh
  },[index])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry}><meshStandardMaterial vertexColors roughness={.92} side={DoubleSide}/></mesh>
}
