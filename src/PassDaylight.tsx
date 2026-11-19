// A shallow veil of illuminated mist at three depths in the opening.
// Its broad ends dissolve before they reach the ball or the court.
import { DoubleSide } from 'three'
export default function PassDaylight(){
  return <group name="Light through the high cleft">
    {[[-8.5,13.5,-32,3.9,20,.41],[-2.6,21,-53,6,26,.41],[-15,18,-60,3.5,24,.45]].map(([x,y,z,w,h,angle])=>
      <mesh key={z} position={[x,y,z]} rotation-z={-angle}>
        <planeGeometry args={[w,h]}/>
        <shaderMaterial transparent depthWrite={false} side={DoubleSide}
          vertexShader="varying vec2 st;void main(){st=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader={`varying vec2 st;void main(){
            float width=.67+.33*(1.-st.y);
            float across=(st.x-.5)/width+.5;
            float body=smoothstep(.02,.35,across)*(1.-smoothstep(.62,1.,across));
            float ends=smoothstep(0.,.32,st.y)*(1.-smoothstep(.82,1.,st.y));
            float slit=.54+.46*pow(cos(13.*across+.17*st.y),2.);
            gl_FragColor=vec4(.94,.80,.54,body*ends*slit*.30);
            #include <colorspace_fragment>
          }`}/>
      </mesh>)}
  </group>
}
