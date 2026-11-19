// One authored mountain spine under the three playable spaces. Shared by rendering and Rapier.
// The summit chasm is genuinely absent; only the unlocked unfolding bridge can cross it.
import { CLOUD_TERRACE, RIDGE_WALK, SUMMIT } from './paintingLayout.ts'
const mix=(a:number,b:number,t:number)=>a+(b-a)*t
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)}
function sample(keys:readonly (readonly [number,number])[],z:number) {
  if(z>=keys[0][0])return keys[0][1]
  for(let i=1;i<keys.length;i++)if(z>=keys[i][0])return mix(keys[i-1][1],keys[i][1],smooth(keys[i-1][0],keys[i][0],z))
  return keys[keys.length-1][1]
}
const heights = [[18,-8.5],[12.5,0],[-11.7,0],[-16.1,.78],[-18.35,.78],[-25.5,4.8],[-43.45,4.8],[-54.6,12],[-67,12],[-82,-8.5]] as const
const widths = [[18,5],[12.5,6.2],[9,8.4],[-8,8.4],[-11.8,6.7],[-15,1.9],[-18.35,1.9],[-25.5,5.8],[-43.45,5.8],[-44,3.2],[-53,3.2],[-54.6,7.2],[-67,7.2],[-82,2]] as const
const leftPeaks = [[18,0],[9,1.2],[-4,2.4],[-17,4.8],[-28,7.2],[-38,5.2],[-47,6.2],[-59,5],[-70,3],[-82,0]] as const
const rightPeaks = [[18,0],[8,1],[-7,2.6],[-20,3.8],[-32,8.2],[-42,4.3],[-52,7],[-63,4.3],[-73,2],[-82,0]] as const
export function terrainCenter(z:number) {return -1.5*smooth(-10,-19,z)}
export function terrainHeight(x:number,z:number) {
  const center=terrainCenter(z),inner=sample(widths,z),outer=inner+8.2,d=Math.abs(x-center)
  const base=z< -18.35 && z> -25.5 ? mix(.78,4.8,(-18.35-z)/7.15)
    : z<RIDGE_WALK.z && z>SUMMIT.z+SUMMIT.length/2 ? mix(RIDGE_WALK.y,SUMMIT.y,(RIDGE_WALK.z-z)/11.15)
    : sample(heights,z)
  const t=Math.max(0,Math.min(1,(d-inner)/(outer-inner)))
  const peak=sample(x<center?leftPeaks:rightPeaks,z)
  // Cross-bedded cliffs rise beyond the playable shelves. Folded beds end in
  // angled scarps and eroded slots instead of a smooth rotational summit.
  const rockZone=smooth(-12,-23,z)*smooth(0,.22,t)*(1-smooth(.82,1,t))
  const side=x<center?-1:1
  const strike=z*.56+side*x*.31+1.34*Math.sin(z*.16+side)
  const spine=1-Math.abs(Math.sin(strike+.38*Math.sin(2.3*strike)))
  const saddle=Math.abs(Math.sin(z*.28+side*.73))
  const uplift=t+rockZone*(.065*Math.sin(strike*.71)+.052*Math.sin(z*.34))
  const mound=Math.max(0,Math.sin(Math.PI*uplift))
  const bed=mound*peak
  const strata=bed*1.5+z*.28+side*x*.19
  const bench=Math.atan(3.6*Math.sin(strata))/1.30
  // Keep the shoulder below the sightline to the pass. The west crest is
  // broken into fins while the eastern shelf exposes the returning bends.
  const aspect=x<center?.55:.34
  // The east shoulder falls into a ravine before the high pass. This cut
  // is beyond the terrace edges so the gate walk and landing stay level.
  const ravine=smooth(4.9,6.5,x)*(1-smooth(8.5,10,x))*smooth(-14,-21,z)*(1-smooth(-49,-54,z))
    + .73*smooth(5.78,7.7,x)*smooth(-48,-52,z)*(1-smooth(-58,-65,z))
  const shoulders=(bed*mound**.5+rockZone*(peak*(.54*spine-.33*saddle)+.105*bench))
    *mix(1,aspect,smooth(-13,-24,z))
  const drop=smooth(.58,1,t)*(base+8.5)
  const relief=.05*Math.sin(z*1.15+x*.38)*Math.sin(x*.9)*smooth(0,.5,t)
  // Cut a gallery waterway into both banks, outside the rally surface.
  const channel=smooth(7.65,8.85,Math.abs(x))*(1-smooth(12.5,14.7,Math.abs(x)))
    *smooth(-15,-8,z)*(1-smooth(8,14,z))
  // Erode the lateral banks behind the cloud court. Keep the horizontal
  // playing shelf, folded bridge and summit footing at their authored heights.
  const valley=smooth(-23,-34,z)*(1-smooth(-48,-55,z))
  const outside=smooth(inner,inner+3.2,d)
  // A low cirque under the moving bridge and summit. The bridge and
  // summit provide their own physical decks when the seals unfold them.
  const cirque=smooth(-42.8,-51,z)*(1-smooth(-68,-79,z))
  const flankCut=cirque*(9+4*smooth(2.6,6,d))
  const rearFoot=smooth(-55,-59,z)*(1-smooth(-68,-77,z))*(1-smooth(2.7,8,d))
  const uncut=base-.18+shoulders-drop+relief-channel*3.7-ravine*2.9
    - valley*outside*(side<0?6.8:0) - flankCut + 3.6*rearFoot
  // Excavate the forecourt for the retaining wings. Keep the centre ramp,
  // threshold and playable pad at their original heights.
  const apron=smooth(2.3,3.45,d)*(1-smooth(6.5,9.0,d))
    *smooth(-12,-16,z)*(1-smooth(-18.9,-23.8,z))
  return mix(uncut,Math.min(uncut,.19+.13*(d-3.2)),apron)
}
export function terrainChasm(x:number,z:number) {
  return z<RIDGE_WALK.z+.15 && z>SUMMIT.z+SUMMIT.length/2-.15 && Math.abs(x-CLOUD_TERRACE.x)<3.05
}
const srgb=(n:number)=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4
const green=[.18,.32,.26].map(srgb),gold=[.64,.46,.23].map(srgb)
export function buildTerrain() {
  const rows=228,cols=108,positions:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[]
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++) {
    const z=18-j/rows*100,center=terrainCenter(z),inner=sample(widths,z),span=inner+8.2,x=center+(i/cols*2-1)*span
    const y=terrainHeight(x,z),t=Math.max(0,Math.min(1,(Math.abs(x-center)-inner)/8.2))
    positions.push(x,y,z);uv.push((x+24)/48,(z+82)/100)
    const accent=smooth(.15,.7,t)*(x>center?.67:.15)*(1-smooth(17,34,Math.abs(z+34)))
    const shade=.80+.17*Math.sin(t*Math.PI)+.025*Math.sin(z*.4+x*.9)
    for(let k=0;k<3;k++)colors.push(mix(green[k],gold[k],accent)*shade)
    if(i&&j){const a=j*(cols+1)+i;const px=(positions[a*3]+positions[(a-cols-2)*3])/2,pz=(positions[a*3+2]+positions[(a-cols-2)*3+2])/2
      if(!terrainChasm(px,pz))indices.push(a,a-1,a-cols-2,a,a-cols-2,a-cols-1)
    }
  }
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),uv:new Float32Array(uv),indices:new Uint32Array(indices)}
}
export const worldTerrain=buildTerrain()
