import { useEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { FrameClock } from './frameClock'
import type { Entry } from './paintingLayout'
import type { Rally } from './rally'

export default function FrameBudget({ rally, entry, fps, frameTime, paused, bellReveal }: {
  rally: Rally; entry: Entry; paused: boolean; fps: number; frameTime: RefObject<number>; bellReveal?: RefObject<number>
}) {
  const invalidate = useThree((state) => state.invalidate)
  const clock = useRef(new FrameClock())
  const pointer = useThree(state => state.pointer)
  const canvas = useThree((state) => state.gl.domElement)

  useFrame(() => {
    const { phase, ritual } = rally.getStatus()
    const running = entry === 'entering' || (entry === 'playing' && (
      phase === 'outbound' || phase === 'incoming' || phase === 'window' ||
      ritual === 'cleared' || ritual === 'unfolding' || ritual === 'moonrise'
    ))
    frameTime.current = clock.current.sample(performance.now() / 1000, running && !paused && !document.hidden)
  }, -3)

  useEffect(() => {
    clock.current.reset()
    const frameMs = 1000 / fps
    const idleMs = 1000 / 12
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)')
    let timer: number | undefined
    let nextFrame = 0
    let settleUntil = 0

    function animate() {
      if (paused) return false
      if (entry !== 'playing') return entry === 'entering'
      const { phase, ritual } = rally.getStatus()
      return phase === 'outbound' || phase === 'incoming' || phase === 'window' ||
        ritual === 'cleared' || ritual === 'unfolding' || ritual === 'moonrise' ||
        (ritual === 'bell' && !!bellReveal && bellReveal.current < 1)
    }

    function showAmbient() {
      if (paused || entry !== 'playing' || reduceMotion.matches || !document.hasFocus()) return false
      const { phase, ritual } = rally.getStatus()
      return phase === 'ready' && !!ritual && ritual !== 'ending'
    }

    function requestFrame() {
      if (timer !== undefined || document.hidden) return
      timer = window.setTimeout(renderFrame, Math.max(0, nextFrame - performance.now()))
    }

    function renderFrame() {
      timer = undefined
      if (document.hidden) return
      const now = performance.now()
      const active = animate() || now < settleUntil
      const ambient = showAmbient()
      const cadence = ambient && !active ? idleMs : frameMs
      nextFrame = nextFrame > 0 ? nextFrame + cadence : now + cadence
      if (nextFrame <= now) nextFrame = now + cadence
      invalidate()
      if (active || ambient) requestFrame()
    }

    function wake() {
      // Let door, lotus and hit feedback settle after a physics state change.
      settleUntil = performance.now() + (paused ? 0 : 1050)
      window.clearTimeout(timer)
      timer = undefined
      nextFrame = 0
      requestFrame()
    }

    function visibilityChanged() {
      clock.current.reset()
      if (!document.hidden) {
        wake()
        return
      }
      window.clearTimeout(timer)
      timer = undefined
    }

    const unsubscribe = rally.subscribe(wake)
    function pointerMoved(event: PointerEvent) {
      const bounds=canvas.getBoundingClientRect()
      pointer.set((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2)
      if (nextFrame - performance.now() > frameMs) {
        window.clearTimeout(timer)
        timer = undefined
        nextFrame = 0
      }
      requestFrame()
    }
    canvas.addEventListener('pointermove', pointerMoved, { passive: true })
    document.addEventListener('visibilitychange', visibilityChanged)
    window.addEventListener('focus', wake)
    reduceMotion.addEventListener('change', wake)
    wake()
    return () => {
      window.clearTimeout(timer)
      unsubscribe()
      canvas.removeEventListener('pointermove', pointerMoved)
      document.removeEventListener('visibilitychange', visibilityChanged)
      window.removeEventListener('focus', wake)
      reduceMotion.removeEventListener('change', wake)
    }
  }, [bellReveal, canvas, entry, fps, invalidate, paused, pointer, rally])

  return null
}
