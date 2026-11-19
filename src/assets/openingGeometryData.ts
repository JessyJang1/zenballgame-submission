import { BufferAttribute, BufferGeometry, Sphere, Vector3, type TypedArray } from 'three'

export function packGeometry(geometry: BufferGeometry) {
  geometry.computeBoundingSphere()
  const sphere = geometry.boundingSphere!
  const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => ({
    name, array: attribute.array, size: attribute.itemSize, normalized: attribute.normalized,
  }))
  return { attributes, index: geometry.index?.array, groups: geometry.groups,
    center: sphere.center.toArray(), radius: sphere.radius }
}

export type PackedGeometry = ReturnType<typeof packGeometry>

export function unpackGeometry(data: PackedGeometry) {
  const geometry = new BufferGeometry()
  for (const { name, array, size, normalized } of data.attributes) {
    geometry.setAttribute(name, new BufferAttribute(array, size, normalized))
  }
  if (data.index) geometry.setIndex(new BufferAttribute(data.index as TypedArray, 1))
  for (const group of data.groups) geometry.addGroup(group.start,group.count,group.materialIndex)
  geometry.boundingSphere = new Sphere(new Vector3().fromArray(data.center), data.radius)
  return geometry
}
