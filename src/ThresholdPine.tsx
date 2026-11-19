import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import { openingGeometry } from './assets/openingGeometry'

export function makeBark() { return openingGeometry('makeBark') }
export function makeNeedles(distant = false) {
  return openingGeometry(distant ? 'farNeedles' : 'makeNeedles')
}

export default function ThresholdPine() {
  const bark=useMemo(makeBark,[])
  const needles=useMemo(()=>makeNeedles(),[])
  useEffect(()=>()=>{bark.dispose();needles.dispose()},[bark,needles])
  return <group name="Cliff pine at the threshold">
    <mesh geometry={bark} receiveShadow>
      <meshStandardMaterial side={DoubleSide} vertexColors roughness={1}/>
    </mesh>
    <mesh geometry={needles}>
      <meshStandardMaterial side={DoubleSide} vertexColors roughness={1} emissive="#273725" emissiveIntensity={.21}/>
    </mesh>
  </group>
}
