import { useEffect, useMemo } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, ShapeUtils, SRGBColorSpace, Vector2 } from 'three'

// Silhouette traced on the supplied painting. The texture is the unchanged, original PNG.
const portrait = [
  [58, 304], [98, 299], [150, 280], [190, 263], [225, 266], [272, 280], [273, 242],
  [287, 210], [311, 190], [329, 179], [346, 188], [366, 211], [377, 239], [374, 267],
  [438, 277], [441, 285], [429, 340], [420, 379], [420, 417], [398, 431], [392, 452],
  [389, 480], [379, 484], [374, 464], [367, 485], [348, 508], [324, 511], [292, 528],
  [280, 565], [268, 561], [252, 521], [242, 506], [233, 513], [212, 539], [190, 553],
  [166, 552], [158, 574], [141, 577], [121, 558], [106, 522], [92, 524], [86, 568],
  [76, 574], [75, 537], [70, 520], [58, 521],
].map(([x, y]) => new Vector2(x, y))

export default function PaintedPlayer() {
  const texture = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/wo-fo-chi-pai.png')
  texture.colorSpace = SRGBColorSpace
  const geometry = useMemo(() => {
    const mesh = new BufferGeometry()
    mesh.setAttribute('position', new Float32BufferAttribute(portrait.flatMap(({ x, y }) => [(x - 261) / 207, (578 - y) / 207, 0]), 3))
    mesh.setAttribute('uv', new Float32BufferAttribute(portrait.flatMap(({ x, y }) => [x / 488, 1 - y / 814]), 2))
    mesh.setIndex(ShapeUtils.triangulateShape(portrait, []).flat())
    return mesh
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <group name="Painted racket bearer">
      <mesh geometry={geometry}>
        <meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  )
}
