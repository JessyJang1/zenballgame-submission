import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import { makeBark, makeNeedles } from './ThresholdPine'

// Smaller members of the same windswept pine species seen in the passage.
// All four trees share the same bark and foliage meshes.
export default function CourtPines(){
  const bark=useMemo(makeBark,[])
  const crown=useMemo(()=>makeNeedles(true),[])
  useEffect(()=>()=>{bark.dispose();crown.dispose()},[bark,crown])
  return <group name="Bank pines">
    {([[-7.45,-.19,-9.1,.53,-.38],[7.6,-.18,-8.6,.45,2.64],
      [-8.94,3.56,-11.72,.66,.48],[10.10,4.12,-16.75,.47,2.64]] as const).map(([x,y,z,size,turn])=>
      <group key={z} position={[x,y,z]} scale={size} rotation-y={turn}>
        <group position={[8.4,0,-49.8]}>
          <mesh geometry={bark} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={1} side={DoubleSide}/></mesh>
          <mesh geometry={crown}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide} emissive="#273725" emissiveIntensity={.21}/></mesh>
        </group>
      </group>)}
  </group>
}
