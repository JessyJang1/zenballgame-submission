import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, LatheGeometry, TubeGeometry, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RACKET_REACH } from '../rallyFigurePose'

export function buildRallyRacket(away: boolean) {
  const parts: BufferGeometry[] = []
  function finish(source: BufferGeometry, color: string) {
    const shape = source.index ? source.toNonIndexed() : source
    if (shape !== source) source.dispose()
    shape.deleteAttribute('uv')
    const tint = new Color(color)
    const colors = new Float32Array(shape.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) colors.set([tint.r,tint.g,tint.b],i)
    shape.setAttribute('color',new BufferAttribute(colors,3))
    parts.push(shape)
  }
  const frame = Array.from({length: 26}, (_, i) => {
    const turn = i / 26 * Math.PI * 2
    return new Vector3(.179 * Math.cos(turn) * (1 + .08*Math.sin(turn)), RACKET_REACH + .226 * Math.sin(turn), 0)
  })
  const outer = new CatmullRomCurve3(frame,true)
  finish(new TubeGeometry(outer,52,.022,7,true),away ? '#806e4a' : '#bb8a51')
  const edge = new CatmullRomCurve3(frame.map(p => new Vector3(p.x*.925, RACKET_REACH+(p.y-RACKET_REACH)*.957, .008)),true)
  finish(new TubeGeometry(edge,48,.009,5,true),away ? '#ad976d' : '#d6b17b')
  for (const side of [-1,1]) {
    const throat = new CatmullRomCurve3([
      new Vector3(.012*side,.16,0),
      new Vector3(.031*side,.262,0),
      new Vector3(.092*side,.355,0),
      new Vector3(.142*side,.442,0),
    ])
    finish(new TubeGeometry(throat,11,.016,6),away ? '#83714e' : '#ac7a4a')
  }
  const profile = [[0,-.088],[.029,-.088],[.036,-.067],[.031,-.043],[.029,.107],[.030,.153],[.022,.186],[0,.186]]
    .map(([radius,height]) => new Vector2(radius,height))
  finish(new LatheGeometry(profile,11),away ? '#303b35' : '#334c45')
  for (let i=0;i<7;i++) {
    const y=-.054+i*.032
    const cord=Array.from({length:9},(_,j)=>new Vector3(
      .031*Math.cos(j*Math.PI*2/8),y+j*.002,.031*Math.sin(j*Math.PI*2/8)))
    finish(new TubeGeometry(new CatmullRomCurve3(cord),10,.0025,4),away ? '#5c5e47' : '#73806a')
  }
  const wood = mergeGeometries(parts)
  parts.forEach(part=>part.dispose())
  const cord: number[]=[]
  for(let i=-5;i<=5;i++){
    const t=i*.165
    const end=Math.sqrt(.97-t*t)
    cord.push(t*.165,RACKET_REACH-end*.212,0,t*.165,RACKET_REACH+end*.212,0)
    cord.push(-end*.165,RACKET_REACH+t*.212,0,end*.165,RACKET_REACH+t*.212,0)
  }
  const strings=new BufferGeometry().setAttribute('position',new BufferAttribute(Float32Array.from(cord),3))
  return {wood,strings}
}
