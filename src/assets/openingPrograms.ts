import recipeUrl from './opening-programs.gz?url'

type GL = WebGLRenderingContext | WebGL2RenderingContext
type Handles = {program: WebGLProgram; vertex: WebGLShader; fragment: WebGLShader; layout?: Layout}
type Layout = {uniforms: unknown; attributes: unknown}
let reflect: ((gl: GL, program: WebGLProgram) => Layout) | undefined
export function registerOpeningReflection(reader: NonNullable<typeof reflect>) { reflect = reader }
type Recipe = {lines: string[]; shaders: number[][]; programs: [number,number,string|null][]}
type Pool = Map<string, Map<string, Map<string|null, Handles>>>

const pools = new WeakMap<GL, Pool>()
const stats = new WeakMap<GL,{hits:number;submitted:number;reflected:number}>()
export function openingProgramCount(gl: GL) { return stats.get(gl)?.submitted ?? 0 }
let recipe: Promise<Recipe | undefined> | undefined

export function fetchOpeningPrograms() {
  if (!import.meta.env.PROD || typeof DecompressionStream === 'undefined') return
  recipe ??= fetch(recipeUrl).then(async response => {
    if (!response.ok || !response.body) return
    return await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json() as Recipe
  }).catch(() => undefined)
}

// Called by the pinned renderer at its ordinary link site. Three retains sole
// ownership of borrowed handles and always performs its normal uniform discovery.
export function takeOpeningProgram(gl: GL, vertex: string, fragment: string, attribute: string|null) {
  const bindings = pools.get(gl)?.get(vertex)?.get(fragment)
  const handles = bindings?.get(attribute)
  if (handles) { bindings!.delete(attribute); stats.get(gl)!.hits++ }
  return handles
}

function dispose(gl: GL, handles: Handles) {
  gl.deleteProgram(handles.program)
  gl.deleteShader(handles.vertex)
  gl.deleteShader(handles.fragment)
}

export function finishOpeningPrograms(gl: GL) {
  const pool = pools.get(gl)
  if (!pool) return
  performance.mark('zenball-program-pool-finished',{detail:stats.get(gl)})
  stats.delete(gl)
  pools.delete(gl)
  for (const fragments of pool.values()) for (const bindings of fragments.values()) {
    for (const handles of bindings.values()) dispose(gl,handles)
  }
  pool.clear()
}

export function startOpeningPrograms(gl: GL) {
  if (!recipe || pools.has(gl)) return
  const pool: Pool = new Map()
  pools.set(gl,pool)
  stats.set(gl,{hits:0,submitted:0,reflected:0})
  void recipe.then(async data => {
    if (!data || pools.get(gl) !== pool) return
    const shaders = data.shaders.map(ids => ids.map(id => data.lines[id]).join('\n'))
    const pending: Handles[] = []
    const extension = gl.getExtension('KHR_parallel_shader_compile')
    let batchStart = performance.now()
    for (const [v,f,attribute] of data.programs) {
      if (pools.get(gl) !== pool || gl.isContextLost()) return
      const vs = shaders[v], fs = shaders[f]
      let fragments = pool.get(vs)
      if (!fragments) pool.set(vs,fragments=new Map())
      let bindings = fragments.get(fs)
      if (!bindings) fragments.set(fs,bindings=new Map())
      if (bindings.has(attribute)) continue
      const vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER)
      const program = gl.createProgram()
      if (!vertex || !fragment || !program) {
        gl.deleteShader(vertex); gl.deleteShader(fragment); gl.deleteProgram(program)
        return
      }
      gl.shaderSource(vertex,vs); gl.compileShader(vertex)
      gl.shaderSource(fragment,fs); gl.compileShader(fragment)
      gl.attachShader(program,vertex); gl.attachShader(program,fragment)
      if (attribute !== null) gl.bindAttribLocation(program,0,attribute)
      gl.linkProgram(program)
      const handles = { program,vertex,fragment }
      bindings.set(attribute,handles)
      pending.push(handles)
      stats.get(gl)!.submitted++
      // Let WebKit's GPU process drain command buffers alongside scene assembly.
      if (performance.now()-batchStart >= 5 || pending.length % 8 === 0) {
        gl.flush()
        if (extension) gl.getProgramParameter(program,extension.COMPLETION_STATUS_KHR)
        await new Promise<void>(resolve=>setTimeout(resolve,0))
        batchStart = performance.now()
      }
    }
    gl.flush()
    const ext = gl.getExtension('KHR_parallel_shader_compile')
    if (!ext || !reflect) return
    let slice = performance.now()
    for (const handle of pending) {
      while (pools.get(gl) === pool && !gl.isContextLost() &&
             !gl.getProgramParameter(handle.program,ext.COMPLETION_STATUS_KHR)) {
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
      }
      if (pools.get(gl) !== pool || gl.isContextLost()) return
      if (!handle.layout && gl.getProgramParameter(handle.program,gl.LINK_STATUS)) {
        handle.layout = reflect(gl,handle.program)
        stats.get(gl)!.reflected++
      }
      if (performance.now()-slice > 5) {
        await new Promise<void>(resolve=>setTimeout(resolve,0))
        slice=performance.now()
      }
    }
  }).catch(() => finishOpeningPrograms(gl))
}
