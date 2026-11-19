export const gardenCamera = { position: [1.25,6.2,22.8], target: [1.25,2.25,-6], fov: 36 } as const
export const LOTUS = { x: -6.12, z: -7.15, radius: .68, openedRadius: .84, height: .16 }
export const LOTUS_BUD_SCALE = .92
export const LOTUS_HEART = { y: LOTUS.height + .17, radius: .24, halfHeight: .14 }

export const LOTUS_PETALS = Array.from({ length: 9 }, (_, index) => {
  const inner = index % 3 === 1
  return {
    yaw: index * Math.PI * 2 / 9,
    closedPitch: inner ? -1.02 : -.70,
    openPitch: inner ? -.47 : -.09,
    scale: inner ? .82 : 1,
  }
})
export const STONE_BELL = {
  x: 5.65, z: -7.65, radius: .64, height: .92,
  profile: [[.64, 0], [.64, .21], [.57, .31], [.52, .57], [.45, .73], [.22, .92]],
}
export const BELL_SEGMENTS = 24

// Court-local coordinates shared by the visible gate, the physics and the camera overlay.
export const GATE = {
  x: -1.5, y: .78, z: -16.9,
  halfOpening: 1.21, openingHeight: 2.45,
  tee: { x: -1.5, y: 1.42, z: -11.2 },
  targetZ: -20.3,
}

// Shared by the Blender bell-mount generator and its simple static collision proxies.
export const BELL_MOUNT = {
  postX: .97, postY: .88, postHalfWidth: .075, postHalfHeight: .88, postHalfDepth: .24,
  beamY: 1.79, beamHalfWidth: 1.17, beamHalfHeight: .09, beamHalfDepth: .25,
  bellHangY: .15,
}

export const COURT_TERRACE = [
  [-5.8, 12.3], [5.8, 12.3], [8.1, 9.3], [8.1, -8.0],
  [6.5, -11.9], [-6.5, -11.9], [-8.1, -8.0], [-8.1, 9.3],
] as const

// The visible basin and the hole in the court masonry share this local outline.
export const LOTUS_BASIN_LOCAL = [
  [-1.27,-.71],[-.82,-1.56],[.05,-1.78],[.93,-1.44],[1.33,-.65],[1.4,.15],
  [1.15,1.1],[.42,1.58],[-.5,1.51],[-1.15,1.05],[-1.45,.25],
] as const


export const LOTUS_BASIN = LOTUS_BASIN_LOCAL.map(([x,z]) => [LOTUS.x+x, LOTUS.z+z] as const)
export function inLotusWater(x:number,z:number) {
  let inside=false
  for(let i=0,j=LOTUS_BASIN.length-1;i<LOTUS_BASIN.length;j=i++){
    const [ax,az]=LOTUS_BASIN[i], [bx,bz]=LOTUS_BASIN[j]
    if((az>z)!==(bz>z) && x<(bx-ax)*(z-az)/(bz-az)+ax)inside=!inside
  }
  return inside
}

// The first-shot reticle describes the intended point. Keep a neutral band
// along the flower boundary, where contact also depends on the flight.
export function lotusAimSurface(x: number, z: number) {
  const distance = Math.hypot(x - LOTUS.x, z - LOTUS.z)
  if (distance <= LOTUS.radius * .8) return 'heart'
  return distance >= LOTUS.radius + .18 && inLotusWater(x,z) ? 'water' : 'stone'
}
