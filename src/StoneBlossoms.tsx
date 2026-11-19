import { useEffect, useMemo } from 'react'
import { Color, CylinderGeometry, DoubleSide, Euler, BufferGeometry, Quaternion, Vector3, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

function buildTrees() {
  const branches: CylinderGeometry[] = []
  const vertices: number[] = [], colors: number[] = []
  const palette = ['#ebd6b4','#ecdac8','#c99481','#f2e3ca'].map(hex => new Color(hex))
  let seed = 4721
  const sample = () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0
    return seed / 4294967296
  }
  const up = new Vector3(0,1,0)
  function limb(start: Vector3, end: Vector3, radius: number) {
    const axis = end.clone().sub(start)
    const mid = start.clone().lerp(end,.5)
    const branch = new CylinderGeometry(radius*.34,radius,axis.length(),9,7)
    const ring=branch.getAttribute('position')
    for(let i=0;i<ring.count;i++){
      const u=ring.getY(i)/axis.length()+.5
      const bend=Math.sin(Math.PI*u)
      ring.setX(i,ring.getX(i)+radius*2.6*bend)
      ring.setZ(i,ring.getZ(i)+radius*1.3*Math.sin(2*Math.PI*u))
    }
    branch.computeVertexNormals()
    branch.applyQuaternion(new Quaternion().setFromUnitVectors(up,axis.normalize()))
    branches.push(branch.translate(mid.x,mid.y,mid.z))
  }
  function flower(center: Vector3) {
    const radius = .046 + sample()*.047
    const yaw = sample()*Math.PI*2
    const tilt = new Quaternion().setFromEuler(new Euler(sample()*2-.55,yaw,sample()*1.4-.7))
    const pigment = palette[Math.floor(sample()*palette.length)]
    function point(angle: number, length: number, height: number, shade: number) {
      const v = new Vector3(Math.cos(angle)*length,height,Math.sin(angle)*length)
        .multiplyScalar(radius).applyQuaternion(tilt).add(center)
      vertices.push(v.x,v.y,v.z)
      colors.push(pigment.r*shade,pigment.g*shade,pigment.b*shade)
    }
    for(let k=0;k<5;k++){
      const a=k*Math.PI*2/5
      point(a,0,0,.62);point(a-.51,.83,.37,1);point(a,1,.56,1)
      point(a,0,0,.62);point(a,1,.56,1);point(a+.51,.81,.32,.95)
    }
  }
  for(const [x,z,side] of [[-8.65,6.8,1],[11.1,5.85,-1]]){
    const base = new Vector3(x,-.08,z)
    const elbow = base.clone().add(new Vector3(-.63*side,1.46,-.32))
    const crown = elbow.clone().add(new Vector3(.9*side,side<0?4.65:1.83,-.24))
    limb(base,elbow,.21);limb(elbow,crown,.145)
    for(let i=0;i<8;i++){
      const angle=i*2.4+sample()*.5
      const dir=new Vector3(Math.cos(angle)*1.4+side*.68,.22+sample()*.48,Math.sin(angle)*1.25)
      const start=i%3===0 ? elbow : crown
      const bend=start.clone().addScaledVector(dir,.86+sample()*.31)
      const tip=bend.clone().addScaledVector(dir,1+sample()*.55)
      tip.y+=.32*sample()
      limb(start,bend,.075);limb(bend,tip,.033)
      for(let j=0;j<7;j++){
        const joint=bend.clone().lerp(tip,j/7)
        const fork=angle+(j%2?1:-1)*(.6+sample()*.7)
        const end=joint.clone().add(new Vector3(Math.cos(fork)*.65,.26+sample()*.4,Math.sin(fork)*.65))
        limb(joint,end,.022)
        for(let bud=0;bud<13;bud++){
          const p=joint.clone().lerp(end,.18+.82*sample())
          p.x+=(sample()-.5)*.18;p.z+=(sample()-.5)*.18
          flower(p)
        }
      }
    }
  }
  const trunk=mergeGeometries(branches), blooms=new BufferGeometry()
  branches.forEach(branch=>branch.dispose())
  blooms.setAttribute('position',new Float32BufferAttribute(vertices,3))
  blooms.setAttribute('color',new Float32BufferAttribute(colors,3))
  blooms.computeVertexNormals()
  return {trunk,blooms}
}

export default function StoneBlossoms() {
  const {trunk,blooms} = useMemo(buildTrees,[])
  useEffect(()=>()=>{trunk.dispose();blooms.dispose()},[trunk,blooms])
  return <group name="Cave garden blossoms">
    <mesh geometry={trunk} castShadow><meshStandardMaterial color="#453a30" roughness={1}/></mesh>
    <mesh geometry={blooms} castShadow><meshStandardMaterial vertexColors side={DoubleSide} roughness={1}/></mesh>
  </group>
}
