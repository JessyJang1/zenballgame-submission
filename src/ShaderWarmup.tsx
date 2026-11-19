import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { Vector4, type Mesh, type ShaderMaterial, type Texture } from 'three'
import { finishOpeningPrograms, openingProgramCount } from './assets/openingPrograms'
import type { Entry } from './paintingLayout'

// A positive priority takes over R3F's automatic draw while the very first
// materials, shadows and reflections initialize under the loading prompt.
function OpeningFrame({ assembled, onReady }: { assembled: boolean; onReady: () => void }) {
  const { gl, scene, camera, invalidate } = useThree()
  const active = useProgress(state => state.active)
  const prepared = useRef(false)
  useFrame(() => {
    if (!prepared.current) return
    gl.shadowMap.needsUpdate = true
    gl.render(scene, camera)
    finishOpeningPrograms(gl.getContext())
    onReady()
  }, 1)
  useEffect(() => {
    if (active || !assembled) return
    let cancelled = false
    async function prepare() {
      const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      await nextFrame()
      if (cancelled) return
      try {
        const drawables: Mesh[] = []
        const textures = new Set<Texture>()
        scene.traverseVisible(object => {
          const mesh = object as Mesh
          if (!mesh.material) return
          drawables.push(mesh)
          for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            const maps = mat as unknown as Record<string, Texture>
            for (const key of ['map','aoMap','normalMap','roughnessMap','metalnessMap','alphaMap','emissiveMap']) {
              if (maps[key]?.isTexture) textures.add(maps[key])
            }
            for (const uniform of Object.values((mat as ShaderMaterial).uniforms ?? {})) {
              if (uniform.value?.isTexture) textures.add(uniform.value)
            }
          }
        })
        gl.shadowMap.needsUpdate = false

        let start = performance.now()
        for (const texture of textures) {
          if (cancelled) return
          gl.initTexture(texture)
          if (performance.now()-start >= 5) {
            await nextFrame()
            start = performance.now()
          }
        }

        // First-use work includes shader linking, uniform reflection,
        // vertex arrays and depth variants. Exercise small sets in the real output color space.
        // Restore all layers before yielding; animation and picking see the live scene.
        const masks = drawables.map(object => object.layers.mask)
        const scissor = new Vector4()
        const reflector = drawables.find(mesh => 'getRenderTarget' in mesh)
        let cursor = 0, batch = openingProgramCount(gl.getContext()) ? 16 : 32
        while (cursor < drawables.length) {
          await nextFrame()
          if (cancelled) return
          const end = Math.min(drawables.length, cursor + batch)
          const began = performance.now()
          const wasScissored = gl.getScissorTest()
          gl.getScissor(scissor)
          try {
            for (let i=0;i<drawables.length;i++) {
              drawables[i].layers.mask = (i >= cursor && i < end) || drawables[i] === reflector ? masks[i] : 0
            }
            gl.setScissorTest(true)
            gl.setScissor(0, 0, 1, 1)
            gl.shadowMap.needsUpdate = true
            gl.render(scene,camera)
          } finally {
            drawables.forEach((mesh,i) => { mesh.layers.mask = masks[i] })
            gl.setScissor(scissor); gl.setScissorTest(wasScissored)
          }
          cursor = end
          batch = Math.min(160,Math.max(8,Math.round(batch * Math.min(2,22 / Math.max(1,performance.now()-began)))))
        }
      } catch (error) {
        console.warn('Opening shader precompile unavailable', error)
      }
      if (!cancelled) { prepared.current = true; invalidate() }
    }
    void prepare()
    return () => { cancelled = true; prepared.current = false }
  }, [active, assembled, gl, scene, camera, invalidate])
  return null
}

export default function ShaderWarmup({entry,assembled,onReady}:{entry:Entry;assembled:boolean;onReady:()=>void}) {
  const { gl } = useThree()
  const [presented,setPresented] = useState(false)
  const priorEntry = useRef(entry)
  useEffect(() => {
    if (entry === 'painting' && priorEntry.current !== 'painting') setPresented(false)
    if (entry !== 'painting') gl.shadowMap.needsUpdate = true
    priorEntry.current = entry
  }, [entry, gl])
  return entry === 'painting' && !presented
    ? <OpeningFrame assembled={assembled} onReady={() => { setPresented(true); onReady() }}/>
    : null
}
