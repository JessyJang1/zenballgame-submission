import { CanvasTexture, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'

export { gardenCamera } from '../gardenLayout'

// Median sRGB values from the six labeled swatches on the approved worldview card.
export const worldviewPalette = {
  stoneGreen: '#2e4d45',
  mossGreen: '#43523b',
  earthGold: '#bc8848',
  stoneWhite: '#cfae83',
  brickRed: '#852f1f',
  oliveGreen: '#887334',
}

export function makeCourtPigment(base: string = worldviewPalette.stoneGreen) {
  const channels=[1,3,5].map(i=>parseInt(base.slice(i,i+2),16))
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 192
  const ctx = canvas.getContext('2d')
  const material = new MeshStandardMaterial({ color: base, roughness: .91, metalness: 0 })
  if (!ctx) return material
  const pixels = ctx.createImageData(192, 192)
  let seed = 26341
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const wash = Array.from({ length: 12 * 12 }, random)
  function sampleWash(x: number, y: number) {
    const cellX = x / 16
    const cellY = y / 16
    const ix = Math.floor(cellX)
    const iy = Math.floor(cellY)
    const u = cellX - ix
    const v = cellY - iy
    const row = (line: number) => {
      const i = (line % 12) * 12
      return wash[i + ix] * (1 - u) + wash[i + (ix + 1) % 12] * u
    }
    return row(iy) * (1 - v) + row(iy + 1) * v
  }
  for (let y = 0; y < 192; y += 1) {
    for (let x = 0; x < 192; x += 1) {
      const grain = Math.round(8 * (random() - .5) + 11 * (sampleWash(x, y) - .5))
      const i = (y * 192 + x) * 4
      pixels.data.set([channels[0] + grain, channels[1] + grain, channels[2] + grain, 255], i)
    }
  }
  ctx.putImageData(pixels, 0, 0)
  ctx.strokeStyle = 'rgba(188,136,72,0.27)'
  ctx.lineWidth = .65
  for (let i = 0; i < 17; i += 1) {
    const x = random() * 192, y = random() * 192
    ctx.beginPath()
    ctx.moveTo(x, y)
    const elbowX = x + 3 + random() * 7
    ctx.lineTo(elbowX, y + 2)
    ctx.lineTo(x + 10 + random() * 11, y + random() * 8)
    if (i % 3 === 0) {
      ctx.moveTo(elbowX, y + 2)
      ctx.lineTo(elbowX + 2, y + 7 + random() * 5)
    }
    ctx.stroke()
  }
  const pigment = new CanvasTexture(canvas)
  pigment.colorSpace = SRGBColorSpace
  pigment.wrapS = pigment.wrapT = RepeatWrapping
  pigment.repeat.set(.19, .19)
  material.color.set('#ffffff')
  material.map = pigment
  return material
}
