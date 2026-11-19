import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { useFrame } from '@react-three/fiber'
import { CatmullRomCurve3, Color, DoubleSide, MathUtils, Path, Shape, ShapeGeometry, SRGBColorSpace, Vector2, Vector3, type Mesh, type ShaderMaterial } from 'three'
import { PAINTING } from './paintingLayout'

// Only the main illustration of the approved worldview card, never its labels or UI.
// Pixels are untouched. Geometry partitions the same illustration into depth layers.
const crop = { x: 20, y: 87, width: 1033, height: 543 }
const actor = [[20,327],[97,298],[176,292],[260,317],[322,335],[334,288],[337,243],[348,212],[375,194],[414,197],[448,213],[465,246],[466,279],[493,288],[510,307],[515,337],[500,377],[492,420],[518,425],[519,456],[494,464],[475,469],[467,506],[460,510],[446,482],[393,494],[362,512],[345,548],[320,541],[302,519],[289,526],[265,555],[230,569],[195,568],[184,596],[162,594],[154,570],[113,572],[100,548],[20,558]]
const head = [[334,288],[337,243],[348,212],[375,194],[414,197],[448,213],[465,246],[466,279],[452,305],[439,326],[416,339],[389,331],[366,314]]
const flowers = [[572,630],[605,573],[634,554],[659,519],[684,520],[700,546],[747,555],[802,524],[839,485],[876,491],[902,515],[941,499],[980,481],[1021,492],[1052,498],[1052,630]]
const bell = [[905,282],[1049,288],[1052,466],[1028,470],[1028,442],[918,442],[918,334],[905,331]]
const vertexShader = `
  uniform vec2 artSize;
  uniform float layerDepth;
  varying vec2 sheetPoint;
  void main() {
    sheetPoint = position.xy * artSize;
    // Equal projection at the starting camera, with genuine depth under camera movement.
    vec2 xy = sheetPoint * (1.0 - layerDepth / 20.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(xy, layerDepth, 1.0);
  }
`
const fragmentShader = `
  uniform sampler2D original;
  uniform vec2 artSize;
  uniform vec2 ballPoint;
  uniform vec3 frameColor;
  uniform vec4 imageRegion;
  uniform float opening;
  varying vec2 sheetPoint;
  void main() {
    vec2 uv = sheetPoint / artSize + .5;
    vec3 pigment = frameColor;
    if (min(uv.x, uv.y) >= 0.0 && max(uv.x, uv.y) <= 1.0)
      pigment = texture2D(original, imageRegion.xy + uv * imageRegion.zw).rgb;
    float radius = length(sheetPoint - ballPoint) + .04 * sin(sheetPoint.x * 8.0 + sheetPoint.y * 5.0);
    float opacity = smoothstep(opening - .18, opening + .12, radius);
    gl_FragColor = vec4(pigment, opacity);
    #include <colorspace_fragment>
  }
`
function points(polygon: number[][]) {
  return polygon.map(([x,y])=>new Vector2((x-crop.x)/crop.width-.5, .5-(y-crop.y)/crop.height))
}
function cutout(outline: number[][], holes: number[][][] = []) {
  const shape = new Shape(points(outline))
  shape.closePath()
  for(const hole of holes) { const path=new Path(points(hole));path.closePath();shape.holes.push(path) }
  return new ShapeGeometry(shape)
}

export default function OriginalPainting({ progress, onReady }: { progress: RefObject<number>; onReady: () => void }) {
  const map = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/worldview-card.png')
  const ballMesh = useRef<Mesh>(null)
  const materials = useRef<(ShaderMaterial | null)[]>([])
  const route = useMemo(()=>new CatmullRomCurve3([
    new Vector3(),new Vector3(),new Vector3(-1.2,9.1,32),new Vector3(.34,3.2,13),new Vector3(.62,1.31,7.35),
  ]),[])
  useEffect(() => { onReady() }, [onReady])
  const layers = useMemo(()=>[
    {geometry:cutout([[-500,-500],[2000,-500],[2000,1800],[-500,1800]], [actor,flowers,bell]),depth:0},
    {geometry:cutout(actor),depth:.22},
    {geometry:cutout(head),depth:.30},
    {geometry:cutout(bell),depth:.12},
    {geometry:cutout(flowers),depth:.55},
  ],[])
  useEffect(()=>()=>layers.forEach(layer=>layer.geometry.dispose()),[layers])
  const uniforms = useMemo(() => {
    map.colorSpace = SRGBColorSpace; map.needsUpdate = true
    const width=1448, height=1086 // Verified dimensions of the untouched source card.
    return {
      original:{value:map},artSize:{value:new Vector2(PAINTING.width,PAINTING.height)},
      ballPoint:{value:new Vector2()},frameColor:{value:new Color('#163b34')},
      imageRegion:{value:[crop.x/width,1-(crop.y+crop.height)/height,crop.width/width,crop.height/height]},
      opening:{value:-1},
    }
  },[map])
  useFrame(({camera})=>{
    const t=progress.current
    if(t===0) {
      const aspect='aspect' in camera ? Number(camera.aspect) : 16/9
      const width=2*20*Math.tan(47*Math.PI/360)*aspect*1.015
      uniforms.artSize.value.set(width,width/(crop.width/crop.height))
      const bx=(PAINTING.ballU-.5)*width, by=(PAINTING.ballV-.5)*uniforms.artSize.value.y
      uniforms.ballPoint.value.set(bx,by)
      route.points[0].set(bx,PAINTING.y+by,PAINTING.z+.05)
      route.points[1].set(bx+.25,PAINTING.y+by+.8,PAINTING.z+2.1)
    }
    const opening=-1+MathUtils.smoothstep(t,.10,.82)*42
    // ShaderMaterial keeps its own scalar uniform objects. Update the actual mounted layers.
    for(const material of materials.current)if(material){
      material.uniforms.opening.value=opening
      material.uniforms.artSize.value.copy(uniforms.artSize.value)
      material.uniforms.ballPoint.value.copy(uniforms.ballPoint.value)
    }
    if(!ballMesh.current)return
    ballMesh.current.visible=t>.012
    route.getPoint(MathUtils.smoothstep(t,.012,.96),ballMesh.current.position)
    ballMesh.current.scale.setScalar(MathUtils.lerp(1.5,1,MathUtils.smoothstep(t,0,.43)))
  },-1)
  return <>
    {layers.map((layer,index)=><mesh key={index} name={index===0?'Original painting':`Original art layer ${index}`} geometry={layer.geometry} position={[0,PAINTING.y,PAINTING.z]}>
      <shaderMaterial ref={value=>{materials.current[index]=value}} vertexShader={vertexShader} fragmentShader={fragmentShader}
        uniforms={{...uniforms,layerDepth:{value:layer.depth}}} transparent depthWrite={false} toneMapped={false} side={DoubleSide}/>
    </mesh>)}
    <mesh ref={ballMesh} visible={false} name="Ball leaving the painting">
      <sphereGeometry args={[.17,24,16]}/><meshBasicMaterial color="#d4bd63" toneMapped={false}/>
    </mesh>
  </>
}
