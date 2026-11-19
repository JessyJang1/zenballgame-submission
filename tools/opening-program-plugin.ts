import type { Plugin } from 'vite'

// The Three r187 renderer does not expose a public hook for adopting an
// already-linked program. Keep its source generation, cache keys, diagnostics,
// reflection and disposal intact. A different link implementation falls back.
export function openingProgramPlugin(): Plugin {
  return {
    name: 'zenball-opening-programs',
    apply: 'build',
    transform(code,id) {
      if (!id.endsWith('/three/src/renderers/webgl/WebGLProgram.js') &&
          !id.endsWith('/three/build/three.module.js')) return
      const create = 'const program = gl.createProgram();'
      const from = 'const glVertexShader = WebGLShader( gl, gl.VERTEX_SHADER, vertexGlsl );'
      const to = 'gl.linkProgram( program );'
      const start = code.indexOf(from), end = code.indexOf(to,start)
      const alloc = code.lastIndexOf(create,start)
      if (start < 0 || end < 0 || alloc < 0 || start-alloc > 40000) return
      const old = code.slice(start,end+to.length)
      const replaced = `const hint = takeOpeningProgram(gl, vertexGlsl, fragmentGlsl,
        parameters.index0AttributeName ?? (parameters.hasPositionAttribute ? 'position' : null));
        const program = hint?.program ?? gl.createProgram();
        let glVertexShader, glFragmentShader;
        if (hint) {
          glVertexShader = hint.vertex; glFragmentShader = hint.fragment;
        } else {
          ${old.replace('const glVertexShader =','glVertexShader =').replace('const glFragmentShader =','glFragmentShader =')}
        }`
      const layout = 'cachedUniforms = new WebGLUniforms( gl, program );'
      const attrs = 'cachedAttributes = fetchAttributeLocations( gl, program );'
      if (!code.includes(layout) || !code.includes(attrs)) return
      const register = 'registerOpeningReflection((gl,program)=>({uniforms:new WebGLUniforms(gl,program), attributes:fetchAttributeLocations(gl,program)}));\n'
      return {code:"import { takeOpeningProgram,registerOpeningReflection } from '/src/assets/openingPrograms';\n"+register+
        code.slice(0,alloc)+code.slice(alloc+create.length,start)+replaced+code.slice(end+to.length).replace(layout,'cachedUniforms = hint?.layout?.uniforms ?? new WebGLUniforms(gl,program);').replace(attrs,'cachedAttributes = hint?.layout?.attributes ?? fetchAttributeLocations(gl,program);'),map:null}
    },
  }
}
