import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, UniformsLib, UniformsUtils, type ShaderMaterial } from 'three'

// Headwater, free fall and catch ledge share one strip. Z bends away at the
// toe so the hanging water reads through parallax as the camera moves.
const courses = [
  { points: [[-7.85,14.12,-40.37],[-7.72,13.65,-39.9],[-7.59,10.74,-39.53],[-7.45,7.86,-39.25],[-7.57,6.55,-38.87]], width: .89 },
  { points: [[11.61,17.74,-54.65],[11.49,17.55,-54.20],[11.43,13.82,-53.87],[11.14,10.66,-53.13]], width: .72 },
]

function waterGeometry() {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = []
  for (const { points, width } of courses) {
    for (let row=0;row<points.length;row++) {
      const [x,y,z] = points[row]
      const edge = width * (row === 0 ? 1 : row === points.length - 1 ? 1.55 : .82)
      const point = positions.length / 3
      positions.push(x-edge/2,y,z,x,y,z+.08,x+edge/2,y,z)
      const v=(points[0][1]-y)/2
      uvs.push(0,v,.5,v,1,v)
      if (row>0) indices.push(point-3,point,point-2,point,point+1,point-2,point-2,point+1,point-1,point+1,point+2,point-1)
    }
  }
  const mesh=new BufferGeometry()
  mesh.setAttribute('position',new Float32BufferAttribute(positions,3))
  mesh.setAttribute('uv',new Float32BufferAttribute(uvs,2))
  mesh.setIndex(indices)
  return mesh
}

export default function CourtVistaFalls() {
  const surface = useMemo(waterGeometry,[])
  const uniforms=useMemo(()=>(UniformsUtils.merge([UniformsLib.fog,{time:{value:0}}])),[])
  const water=useRef<ShaderMaterial>(null)
  useEffect(()=>()=>surface.dispose(),[surface])
  useFrame((_,delta)=>{if(water.current) uniforms.time.value+=Math.min(.05,delta)})
  return <mesh geometry={surface} name="Water over the high cliffs">
    <shaderMaterial ref={water} uniforms={uniforms} transparent depthWrite={false} side={DoubleSide}
      vertexShader={`varying vec2 st;
        #include <fog_pars_vertex>
        void main(){
          st=uv;
          vec4 mvPosition=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`}
      fog fragmentShader={`
        varying vec2 st; uniform float time;
        #include <fog_pars_fragment>
        void main(){
          float wrap=sin(st.x*27.+.28*sin(st.y*2.1-time*2.7));
          float pulse=.5+.5*sin(st.y*23.-time*10.+wrap);
          float feather=smoothstep(0.,.28,st.x)*smoothstep(0.,.22,1.-st.x);
          float tail=1.-smoothstep(2.7,3.78,st.y);
          vec3 ripple=mix(vec3(.17,.32,.28),vec3(.68,.74,.63),.50+.19*wrap+.12*pulse);
          gl_FragColor=vec4(ripple,feather*tail*(.58+.29*pulse));
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`} />
  </mesh>
}
