import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, MathUtils, Object3D, Vector3, type DirectionalLight, type Group, type HemisphereLight } from 'three'
import { CLOUD_TERRACE, SUMMIT, type Entry } from './paintingLayout'
import type { Ritual } from './rally'
import { FOLIO } from './finaleLayout'

const neutral = new Color('#f5f0e4')
const mineralSun = new Color('#fff0d0')
const valleySun = new Vector3(-16,25,-12)
const summitMoon = new Vector3(-11,19,-22)
const moonSilver = new Color('#d8e4fc')
const hillFill = new Color('#bdd8d0')
const hillGround = new Color('#233f39')
const moonFill = new Color('#acbde0')
const stoneBounce = new Color('#9d8260')

export default function SceneLighting({ritual,entry,entryProgress,world,folioTime}:{
  ritual:Ritual;entry:Entry;entryProgress:RefObject<number>;world:RefObject<Group | null>;folioTime:RefObject<number>
}) {
  const light=useRef<DirectionalLight>(null),target=useMemo(()=>new Object3D(),[])
  const fill=useRef<HemisphereLight>(null)
  const highland=useRef(0)
  const where=useRef(new Vector3())
  const desired=useMemo(()=>{
    if(ritual==='ending'||ritual==='moonrise')return new Vector3(-1.5,5,-32)
    if(ritual==='summit')return new Vector3(SUMMIT.x,SUMMIT.y,SUMMIT.z)
    if(ritual==='mountain'||ritual==='unfolding')return new Vector3(CLOUD_TERRACE.x,CLOUD_TERRACE.y,CLOUD_TERRACE.z)
    return new Vector3(0,0,-4)
  },[ritual])
  const offset=useMemo(()=>new Vector3(-12,23,10),[])
  const gl=useThree(s=>s.gl),until=useRef(0),lastSun=useRef(-1)
  useEffect(()=>{until.current=performance.now()+1500;gl.shadowMap.needsUpdate=true},[desired,gl])
  useFrame((_,delta)=>{
    if(!light.current)return
    const alpha=1-Math.exp(-Math.min(delta,.05)*7)
    where.current.lerp(desired,alpha)
    target.position.copy(where.current)
    const cave = ritual==='lotus' || ritual==='bell' || ritual==='passage' || ritual==='cleared'
    const sunlight = !cave ? 0 : entry==='playing' ? 1 : MathUtils.smoothstep(entryProgress.current,.36,.88)
    const high = ritual==='summit' ? 1 : ritual==='moonrise' ? .86 : 0
    const reliefLight = MathUtils.smoothstep(folioTime.current, FOLIO.moonHold + .7, FOLIO.upright)
    highland.current = MathUtils.lerp(highland.current, high, alpha)
    if (Math.abs(sunlight-lastSun.current)>.075 || (sunlight===1 && lastSun.current!==1)) {
      gl.shadowMap.needsUpdate=true
      lastSun.current=sunlight
    }
    light.current.color.copy(neutral).lerp(mineralSun,sunlight*.55).lerp(moonSilver,highland.current*.82).lerp(mineralSun,reliefLight*.25)
    light.current.intensity=2.25+sunlight*.32+highland.current*.55+reliefLight*.45
    light.current.position.copy(offset).lerp(valleySun,sunlight).lerp(summitMoon,highland.current).add(where.current)
    if(fill.current) {
      fill.current.color.copy(hillFill).lerp(moonFill,highland.current)
      fill.current.groundColor.copy(hillGround).lerp(stoneBounce,highland.current)
      fill.current.intensity=(cave ? 1.9-sunlight*.32 : 1.9)-highland.current*.24+reliefLight*.54
    }
    const painting = world.current
    if (painting) {
      target.position.applyMatrix4(painting.matrix)
      light.current.position.applyMatrix4(painting.matrix)
      fill.current?.position.set(0,1,0).applyQuaternion(painting.quaternion)
    }
    if(performance.now()<until.current)gl.shadowMap.needsUpdate=true
  },-1)
  return <>
    <hemisphereLight ref={fill} args={['#bdd8d0','#233f39',1.9]}/>
    <primitive object={target}/>
    <directionalLight ref={light} position={[-12,23,6]} target={target} color="#fff1d9" intensity={2.25}
      castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      shadow-camera-left={-25} shadow-camera-right={25} shadow-camera-top={29} shadow-camera-bottom={-29}
      shadow-camera-near={.5} shadow-camera-far={90} shadow-intensity={.55} shadow-bias={-.0002} shadow-normalBias={.025}/>
  </>
}
