import { Component, createContext, Suspense, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import { AnimationMixer, Box3, LoopOnce, Vector3, type AnimationAction } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { admittedModels, type Catalog } from './assetAdmission'

export type Slot = keyof Catalog

type Motion = () => { clip: string; seconds: number; loop?: boolean }
type Fit = readonly [number, number, number]

const assetBase = import.meta.env.BASE_URL + 'assets/'
const CatalogContext = createContext<Catalog>({})
const reviewFiles = {
  gateShoulder: '/art/staging/lux3d/gate-ledge-browser.glb',
  lotusPetal: '/art/staging/lux3d/lotus-petal-runtime.glb',
  courtyardRoof: '/art/staging/lux3d/gate-roof-runtime.glb',
  thresholdPlug: '/art/staging/lux3d/entrance-runtime.glb',
} as const
const reviewing = import.meta.env.DEV ? new URLSearchParams(location.search).getAll('lux3dCandidate') : []

let catalogRequest: Promise<Catalog> | undefined
let initialCatalog: Catalog | undefined

function readCatalog() {
  catalogRequest ??= fetch(assetBase + 'manifest.json').then(async response => {
    if (!response.ok) throw new Error('Asset manifest HTTP ' + response.status)
    const catalog = admittedModels(await response.json())
    initialCatalog = catalog
    return catalog
  }).catch(error => { catalogRequest = undefined; throw error })
  return catalogRequest
}

// Start the opening's existing requests alongside Rapier, before React builds
// temporary meshes or suspends repeatedly on dependent texture requests.
export function preloadOpening() {
  for (const file of ['stone-prologue-card.png','worldview-card.png','gallery-flagstone.webp',
    'court-fresco.webp','gallery-silk.webp','escarpment-mineral.jpg','shan-men.png']) {
    useTexture.preload(assetBase+'art/'+file)
  }
  useTexture.preload(['pier','rail','votive'].map(id=>assetBase+'art/gallery-'+id+'.webp'))
  useGLTF.preload(assetBase+'models/threshold-stone-set.glb',false,false)
  void readCatalog().then(catalog => {
    for (const model of Object.values(catalog)) useGLTF.preload(assetBase+model.file,false,false)
  }).catch(() => { /* AssetCatalog retries and handles the normal fallback. */ })
}

export function AssetCatalog({ children }: { children: ReactNode }) {
  const [catalog,setCatalog] = useState<Catalog>(() => initialCatalog ?? {})
  useEffect(() => {
    let live = true
    void readCatalog().then(value => {
      if (!live) return
      setCatalog(value)
      if (!value.bell) window.dispatchEvent(new CustomEvent('zenball-asset-warning'))
    }).catch(error => {
      if (live) {console.warn('Asset manifest unavailable',error);window.dispatchEvent(new CustomEvent('zenball-asset-warning'))}
    })
    return () => { live = false }
  },[])
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>
}

export class ModelFallback extends Component<{ fallback: ReactNode; children: ReactNode; slot: Slot | 'threshold-stone-set' | 'cloud-cliff' | 'court-ravine' }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error) {
    console.warn(`3D asset slot ${this.props.slot}`, error.message)
    window.dispatchEvent(new CustomEvent('zenball-asset-warning',{detail:{slot:this.props.slot}}))
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function LoadedModel({ file, scale, fit, sphere, motion, requiredClip, preview }: {
  file: string; scale: number; fit?: Fit; sphere?: number; motion?: Motion; requiredClip?: string; preview?: boolean
}) {
  // Use self-contained browser-ready GLBs. Uncompressed files need no remote decoder.
  const { scene, animations } = useGLTF(preview ? file : assetBase + file, false, false)
  const model = useMemo(() => {
    const model=clone(scene)
    model.traverse(object=>{object.castShadow=true;object.receiveShadow=true})
    return model
  }, [scene])
  const gl=useThree(state=>state.gl)
  useEffect(()=>{gl.shadowMap.needsUpdate=true},[gl,model])
  // Measure the detached clone once; an inline fit tuple can change identity
  // after attachment, when world bounds already include the parent placement.
  const bounds = useMemo(() => new Box3().setFromObject(model),[model])
  const transform = useMemo(() => {
    if (bounds.isEmpty() || !Number.isFinite(bounds.max.lengthSq())) throw new Error('Empty or invalid GLB bounds')
    const center = bounds.getCenter(new Vector3())
    const size = bounds.getSize(new Vector3())
    if (fit && Math.min(size.x, size.y, size.z) <= 0) throw new Error('Cannot fit a flat model')
    if (sphere) {
      const diameter = Math.max(size.x, size.y, size.z)
      if (diameter <= 0) throw new Error('Invalid ball dimensions')
      const factor = sphere / diameter
      return { scale: factor, position: center.multiplyScalar(-factor) }
    }
    if (!fit) return { scale, position: [0, 0, 0] as const }
    const factors = new Vector3(fit[0] / size.x, fit[1] / size.y, fit[2] / size.z)
    return { scale: factors, position: new Vector3(-center.x, -bounds.min.y, -center.z).multiply(factors) }
  }, [bounds, scale, fit, sphere])
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const active = useRef<AnimationAction | null>(null)
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(model) }, [mixer, model])

  useFrame(() => {
    if (!motion) return
    const state = motion()
    const clip = animations.find((item) => item.name === state.clip)
    if (!clip) {
      active.current?.stop()
      active.current = null
      return
    }
    const action = mixer.clipAction(clip)
    if (active.current !== action) {
      active.current?.stop()
      active.current = action
      action.reset().setLoop(LoopOnce, 1).play()
      action.paused = true
    }
    action.time = state.loop && clip.duration > 0
      ? state.seconds % clip.duration : Math.max(0, Math.min(clip.duration - .0001, state.seconds))
    mixer.update(0)
  })

  if (requiredClip && !animations.some((clip) => clip.name === requiredClip && clip.duration > 0)) {
    throw new Error(`Required animation clip missing: ${requiredClip}`)
  }
  return (
    <group name={file} scale={transform.scale} position={transform.position}>
      <primitive object={model} dispose={null} />
    </group>
  )
}

export function AssetSlot({ slot, children, fit, sphere, motion, requiredClip, detail }: {
  slot: Slot; children: ReactNode; fit?: Fit; sphere?: number; motion?: Motion; requiredClip?: string; detail?: ReactNode
}) {
  const asset = useContext(CatalogContext)[slot]
  const preview = reviewing.includes(slot) && slot in reviewFiles
  const file = preview ? reviewFiles[slot as keyof typeof reviewFiles] : asset?.file
  if (!preview && (typeof file !== 'string' || !/^models\/(?:[\w-]+\/)*[\w.-]+\.glb$/i.test(file))) return children
  if (!file) return children
  const requestedScale = asset?.scale
  const scale = typeof requestedScale === 'number' && Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1
  return (
    <ModelFallback key={file} fallback={children} slot={slot}>
      <Suspense fallback={children}>
        <LoadedModel file={file} scale={scale} fit={fit} sphere={sphere} motion={motion} requiredClip={requiredClip} preview={preview} />
        {detail}
      </Suspense>
    </ModelFallback>
  )
}
