import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Trail, type MeshLineGeometry } from '@react-three/drei'

// Trail's portal creates resources outside the normal parent disposal tree.
export default function BallTrail({ children, color }: { children: ReactNode; color: string }) {
  const trail = useRef<MeshLineGeometry>(null)

  useEffect(() => {
    const geometry = trail.current?.geometry
    return () => { geometry?.dispose() }
  }, [])

  useLayoutEffect(() => {
    const material = trail.current?.material
    return () => {
      if (Array.isArray(material)) material.forEach(item => item.dispose())
      else material?.dispose()
    }
  }, [children, color])

  return (
    <Trail ref={trail} width={.45} length={2} color={color} stride={.025} attenuation={width => width * width}>
      {children}
    </Trail>
  )
}
