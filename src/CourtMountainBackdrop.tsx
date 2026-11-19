import { useEffect, useMemo } from 'react'
import { DoubleSide } from 'three'
import type { Ritual } from './rally'
import { makeStratifiedCourtStone } from './StoneCourtGroundwork'

import { openingGeometry } from './assets/openingGeometry'

export default function CourtMountainBackdrop({ritual}:{ritual:Ritual}){
  const geometry=useMemo(()=>openingGeometry('buildRidges'),[])
  const stone=useMemo(()=>{
    const cliff = makeStratifiedCourtStone('#cbd8cc',true)
    cliff.side = DoubleSide
    cliff.flatShading = true
    return cliff
  },[])
  useEffect(()=>()=>{geometry.dispose();stone.dispose()},[geometry,stone])
  const visible=ritual==='lotus'||ritual==='bell'||ritual==='passage'||ritual==='cleared'
  return <mesh name="Three faulted ridges behind the court" geometry={geometry} material={stone} visible={visible}/>
}
