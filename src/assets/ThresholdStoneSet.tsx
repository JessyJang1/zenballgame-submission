import { Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Mesh, MeshStandardMaterial } from 'three'
import { ModelFallback } from './AssetSlots'

export const thresholdStoneFile = import.meta.env.BASE_URL + 'assets/models/threshold-stone-set.glb'
type StoneName = 'HeroGateStone' | 'ThresholdPaverA' | 'ThresholdPaverB'

export function ThresholdStoneAsset({
  name, position, rotation = 0, scale = [1,1,1],
}: {
  name: StoneName
  position?: [number, number, number]
  rotation?: number
  scale?: [number, number, number]
}) {
  const {nodes}=useGLTF(thresholdStoneFile,false,false)
  const node=nodes[name]
  if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)) {
    throw new Error('Missing stone mesh or PBR material: '+name)
  }
  const material=useMemo(()=>{
    const pigment=node.material.clone() as MeshStandardMaterial
    if (name !== 'HeroGateStone') pigment.color.setRGB(1.56,1.09,.66)
    return pigment
  },[name,node])
  const gl=useThree(state=>state.gl)
  useEffect(()=>{
    gl.shadowMap.needsUpdate=true
    return ()=>material.dispose()
  },[gl,material])
  return <mesh name={name} geometry={node.geometry} material={material} dispose={null}
    position={position} rotation-y={rotation} scale={scale} castShadow receiveShadow/>
}

export function ThresholdStoneBoundary({fallback,children}:{fallback:ReactNode;children:ReactNode}) {
  return <ModelFallback slot="threshold-stone-set" fallback={fallback}>
    <Suspense fallback={fallback}>{children}</Suspense>
  </ModelFallback>
}
