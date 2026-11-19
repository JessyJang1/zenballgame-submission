import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three'
import Court from './Court'
import { prepareOpeningGeometry } from './assets/openingGeometryJob'
import { preloadOpening } from './assets/AssetSlots'
import AssetReview from './AssetReview'
import { CLOUD_TERRACE, SUMMIT, type Entry } from './paintingLayout'
import { GATE } from './gardenLayout'
import { COURT, initPhysics, Rally, type RallyStatus } from './rally'
import { RallySound, type SoundScene } from './sound'
import { GameButton, GameDialog, GameIcon, GameWordmark, readVolume, VolumeSlider } from './GameInterface'
import './style.css'
import './game-interface.css'

const reviewWorld = new URLSearchParams(window.location.search).get('review') === 'world'
const debugCourt = new URLSearchParams(window.location.search).get('debug') === 'court'

const faultText = {
  net: '球碰网了',
  water: '球落水了。瞄准水面上方的莲心。',
  frame: '球撞上了钟架',
  out: '球越出了石坪范围',
  miss: '错过了挥拍时机',
  gate: '球没有穿过门洞',
  'sky-rim': '球碰到了月门的石沿。再对准圆心一点。',
  'sky-miss': '球掠过了月门。看着拍线再瞄一次。',
}

const qualityText = {
  clean: '击中甜点，回球更快',
  good: '成功击球',
  soft: '擦边击中，回球较慢',
}

function getPrompt(status: RallyStatus): [string, string] {
  switch (status.phase) {
    case 'ready': return ['准备发球', '按空格开始对拉']
    case 'outbound': return ['球飞向对场', status.quality ? qualityText[status.quality] : '观察影子的回球']
    case 'incoming': return status.early
      ? ['挥拍偏早', '等提示变亮再按空格']
      : ['看球落地', '白圈是预计落点']
    case 'window': return ['现在挥拍', '按空格回球']
    case 'ended': return [status.fault ? faultText[status.fault] : '本轮结束', '按 R 重开']
  }
}

function getGardenPrompt(status: RallyStatus, introduced: boolean) {
  if (status.ritual === 'ending') return '第一卷 · 施主请打球'
  if (status.ritual === 'moonrise') return '最后一球没有落下。'
  if (status.ritual === 'unfolding') return '山纹里的路，向远处展开了。'
  if (status.ritual === 'summit') return status.fault ? faultText[status.fault] : status.phase === 'ready'
    ? '移动鼠标，等月门的石沿亮起再送球。' : '看灵球穿过月门。'
  if (status.ritual === 'mountain' && status.sealContact === 'soft')
    return '击中了亮纹，但这一拍偏轻。'
  if (status.ritual === 'mountain' && status.sealContact === 'wrong')
    return '击中了未亮的山纹。回击另一侧。'
  if (status.ritual === 'mountain' && !status.fault) {
    const seal = status.mountainSeal === 'left' ? '左侧山纹' : '右侧山纹'
    if (status.phase === 'ready') return '向影子的左边或右边发一球。'
    if (status.phase === 'incoming') return status.early ? '挥拍早了，等球弹起。' : `瞄准${seal}。等来球弹起，再按空格。`
    if (status.phase === 'window') return status.mountainWindow === 'late'
      ? '这一拍已晚。下次在球边金环亮时挥拍。' : `回击${seal}`
    return status.mountainSeal ? (status.quality === 'soft' ? '这拍太轻，等球弹起再挥拍。' : '看回球能否击中亮纹。') : '看墨影会唤醒哪一道山纹。'
  }
  if (status.ritual === 'cleared') return '灵球越过门槛。门后那条山路，拐进了云里。'
  if (status.phase === 'ended') return status.fault ? faultText[status.fault] : '本轮结束'
  if (status.ritual === 'passage') return status.phase === 'ready' ? '门开了。再送一球进去。' : '球已出拍'
  switch (status.phase) {
    case 'ready': return status.ritual === 'bell' ? '瞄准钟身，按空格击球' : introduced ? '瞄准对岸莲心' : '「施主，请接球。」'
    case 'outbound': return status.quality === 'clean' ? '完美击球'
      : status.quality === 'soft' ? '轻擦到球' : '球已出拍'
    case 'incoming': return status.early ? '挥拍偏早，等球弹起' : '看球的落点'
    case 'window': return '现在挥拍'
  }
}

function Game({ rally, audio }: { rally: Rally; audio: RallySound }) {
  const status = useSyncExternalStore(rally.subscribe, rally.getStatus)
  const progress = useRef<HTMLDivElement>(null)
  const aimCamera = useRef<Camera>(null)
  const pointer = useRef({
    ray: new Raycaster(), ndc: new Vector2(), point: new Vector3(),
    floor: new Plane(new Vector3(0, 1, 0), 0),
    opening: new Plane(new Vector3(0, 0, 1), -GATE.z),
    sky: new Plane(new Vector3(0, 0, 1), -SUMMIT.aperture.z),
  })
  const [attempt, setAttempt] = useState(0)
  const bellReveal = useRef(0)
  const [bellRevealed, setBellRevealed] = useState(false)
  const [paused, setPaused] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pauseSoundOpen, setPauseSoundOpen] = useState(false)
  const settingsLauncher = useRef<HTMLButtonElement>(null)
  const stageElement = useRef<HTMLElement>(null)
  const wasPaused = useRef(false)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('zenball-muted') === '1' } catch { return false }
  })
  useEffect(() => {
    audio.setMuted(muted)
    try { localStorage.setItem('zenball-muted', muted ? '1' : '0') } catch { /* Play still works without storage. */ }
  }, [audio, muted])
  const [musicVolume, setMusicVolume] = useState(() => readVolume('zenball-music', .72))
  const [effectsVolume, setEffectsVolume] = useState(() => readVolume('zenball-effects', .85))
  useEffect(() => {
    audio.setMix(musicVolume, effectsVolume)
    try {
      localStorage.setItem('zenball-music', String(musicVolume))
      localStorage.setItem('zenball-effects', String(effectsVolume))
    } catch { /* Play still works without storage. */ }
  }, [audio, musicVolume, effectsVolume])
  const [assetWarning,setAssetWarning]=useState(false)
  useEffect(()=>{
    const warn=()=>setAssetWarning(true)
    window.addEventListener('zenball-asset-warning',warn)
    return()=>window.removeEventListener('zenball-asset-warning',warn)
  },[])
  const [entry, setEntry] = useState<Entry>(debugCourt || (reviewWorld && !new URLSearchParams(location.search).has('intro')) ? 'playing' : 'painting')
  const [worldReady,setWorldReady] = useState(false)
  const showWorld=useCallback(()=>setWorldReady(true),[])
  const entered = entry === 'playing'
  useEffect(() => {
    if (!entered) return
    const hide = () => { if (document.hidden) setPaused(true) }
    document.addEventListener('visibilitychange', hide)
    return () => document.removeEventListener('visibilitychange', hide)
  }, [entered])
  useEffect(() => {
    audio.pause(paused)
    if (wasPaused.current && !paused && entered) stageElement.current?.focus({preventScroll:true})
    wasPaused.current = paused
  }, [audio, paused, entered])
  useEffect(() => {
    let place: SoundScene = 'court'
    if (entry === 'painting') place = 'stone'
    else if (entry === 'entering') place = 'tunnel'
    else if (status.ritual === 'passage' || status.ritual === 'cleared') place = 'gate'
    else if (status.ritual === 'mountain' || status.ritual === 'unfolding') place = 'ridge'
    else if (status.ritual === 'summit') place = 'summit'
    else if (status.ritual === 'moonrise') place = 'moon'
    else if (status.ritual === 'ending') place = 'ending'
    audio.landscape(place)
  }, [audio, entry, status.ritual])
  useEffect(() => { if (status.ritual === 'ending') audio.closeVolume() }, [audio, status.ritual])
  const openingServe=useRef<(() => void) | null>(null)
  const serveSound=useCallback(()=>{audio.unlock();audio.play('serve')},[audio])
  const startEntry = useCallback(() => {
    if (!worldReady || entry !== 'painting' || settingsOpen) return
    audio.wakeStone()
    setEntry('entering')
  }, [audio, entry, worldReady, settingsOpen])
  const completeEntry = useCallback(() => setEntry('playing'), [])
  const togglePause = useCallback((value: boolean) => {
    if (!value) {
      audio.pause(false)
      audio.menu()
      setPauseSoundOpen(false)
    }
    setPaused(value)
  }, [audio])
  const closeHomeSettings = useCallback(() => {
    setSettingsOpen(false)
    requestAnimationFrame(() => settingsLauncher.current?.focus({preventScroll:true}))
  }, [])
  const [introduced, setIntroduced] = useState(false)

  const lastAim = useRef<{ canvas: HTMLCanvasElement; clientX: number; clientY: number } | null>(null)
  const applyPointerAim = useCallback(() => {
    if (!lastAim.current || !aimCamera.current) return
    const { canvas, clientX, clientY } = lastAim.current
    const { ritual } = rally.getStatus()
    const atGate = ritual === 'passage', summit = ritual === 'summit'
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const { ray, ndc, point, floor, opening, sky } = pointer.current
    ndc.set((clientX - bounds.left) * 2 / bounds.width - 1,
      1 - (clientY - bounds.top) * 2 / bounds.height)
    ray.setFromCamera(ndc, aimCamera.current)
    floor.constant = ritual === 'mountain' ? -CLOUD_TERRACE.y : 0
    if (!ray.ray.intersectPlane(summit ? sky : atGate ? opening : floor, point)) return
    if (atGate) {
      const ratio = (GATE.targetZ - GATE.tee.z) / (GATE.z - GATE.tee.z)
      rally.setAim(GATE.tee.x + (point.x - GATE.tee.x) * ratio)
    } else {
      rally.setAim(point.x, point.z, point.y)
    }
  }, [rally])

  useEffect(() => {
    if (entered && !paused && status.phase === 'ready') applyPointerAim()
  }, [entered, paused, status.phase, status.ritual, attempt, applyPointerAim])

  const stroke = useCallback(() => {
    if (paused || (rally.getStatus().ritual === 'bell' && bellReveal.current < 1)) return
    audio.unlock()
    applyPointerAim()
    rally.swing()
    setIntroduced(true)
  }, [audio, rally, paused, applyPointerAim])

  const reset = useCallback((full = false) => {
    const { ritual } = rally.getStatus()
    if (!full && (ritual === 'cleared' || ritual === 'unfolding' || ritual === 'moonrise')) return
    setPaused(false)
    setPauseSoundOpen(false)
    setSettingsOpen(false)
    audio.unlock()
    if (full || debugCourt) {
      lastAim.current = null
      bellReveal.current = 0
      setBellRevealed(false)
      rally.reset()
      setIntroduced(false)
      if (!debugCourt) {setEntry('painting');setWorldReady(false)}
    } else rally.retry()
    setAttempt((value) => value + 1)
  }, [audio, rally])

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.isContentEditable) return
      if (settingsOpen) {
        if (event.code === 'Escape') {
          event.preventDefault()
          if (!event.repeat) closeHomeSettings()
        }
        return
      }
      if (entered && (event.code === 'Escape' || event.code === 'KeyP')) {
        event.preventDefault()
        if (!event.repeat) {
          if (paused && pauseSoundOpen) setPauseSoundOpen(false)
          else togglePause(!paused)
        }
        return
      }
      if (paused) return
      if (!entered) {
        if (entry === 'painting' && event.code === 'Space' && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault()
          if (!event.repeat) openingServe.current?.()
        }
        return
      }
      if (event.code === 'KeyR') {
        event.preventDefault()
        if (!event.repeat) reset(event.shiftKey || rally.getStatus().ritual === 'ending')
      }
      if (event.code === 'Space') {
        // Let keyboard users activate a focused button normally.
        if (event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        if (!event.repeat) stroke()
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [entered, entry, paused, pauseSoundOpen, settingsOpen, closeHomeSettings, rally, reset, stroke, togglePause])

  const [prompt, detail] = getPrompt(status)
  const ready = status.phase === 'ready'
  const ended = status.phase === 'ended'
  const goal = status.returns >= 3

  if (status.ritual) {
    const cleared = status.ritual === 'cleared'
    const summit = status.ritual === 'summit'
    const ending = status.ritual === 'ending'
    const unfolding = status.ritual === 'unfolding'
    const moonrise = status.ritual === 'moonrise'
    const beyond = status.ritual === 'mountain' || unfolding || summit || moonrise || ending
    const transition = cleared || unfolding || moonrise
    const gardenPrompt = getGardenPrompt(status, introduced)
    const bellEmerging = status.ritual === 'bell' && !bellRevealed
    const lateAtSeal = status.ritual === 'mountain' && status.phase === 'window' && status.mountainWindow === 'late'
    const mountainRetry = status.ritual === 'mountain' && !!status.mountainHits
    const atGate = status.ritual === 'passage'
    const firstServe = status.ritual === 'lotus' && ready && !introduced
    const chapter = ending ? '终章　长卷' : summit || moonrise ? '第三重　月台' : beyond ? '第二重　云径台' : '第一重　洞天球庭'
    const actionHint = beyond && !summit ? '瞄准墨影一侧' : summit ? '对准月门，等石沿亮起' : atGate ? '瞄准门洞' : status.ritual === 'bell' ? '瞄准钟身' : '瞄准莲心'
    const cloudOpening = status.ritual === 'mountain' && ready && !status.mountainSeal
    const objective = ending ? '禅球日历 · 第一卷' : moonrise ? '一球化月' : summit ? '送球穿过月门'
      : unfolding ? '山水展开' : cloudOpening ? '先把球送到墨影身旁' : beyond ? `依次击亮两道山纹 · ${status.mountainHits ?? 0}/2` : cleared ? '山门已开' : atGate ? '送球穿过山门'
      : status.ritual === 'bell' ? bellEmerging ? '莲已开，循水纹看向右侧' : '瞄准钟身，击响石钟' : '瞄准对岸的莲心'
    const route = summit || moonrise ? ['月门', '化月', '成卷'] : beyond ? ['一纹', '二纹', '展山'] : ['莲心', '石钟', '山门']
    const routeStep = summit ? 0 : moonrise ? 1 : unfolding ? 2 : status.ritual === 'mountain'
      ? (status.mountainHits ?? 0) : cleared || atGate ? 2 : status.ritual === 'bell' ? 1 : 0
    const soundControls = <fieldset className="game-mix">
      <legend>音量</legend>
      <VolumeSlider label="配乐" value={musicVolume} onChange={setMusicVolume} />
      <VolumeSlider label="音效与环境" value={effectsVolume} onChange={setEffectsVolume} />
      <GameButton icon={muted ? 'muted' : 'sound'} aria-pressed={muted} onClick={() => setMuted(value => !value)}>
        {muted ? '开启声音' : '静音'}
      </GameButton>
    </fieldset>
    return (
      <main className="garden-game" data-ritual={status.ritual} data-entry={entry} data-paused={paused}
        data-mountain-seal={status.mountainSeal} data-lotus-contact={rally.lotusContact ?? undefined}
        data-bell-revealed={status.ritual === 'bell' ? bellRevealed : undefined}>
        <section ref={stageElement} tabIndex={-1} className="garden-stage" data-entry={entry} aria-label="禅球界画境"
          onPointerMove={(event) => {
            if (!event.isPrimary || !(event.target instanceof HTMLCanvasElement)) return
            lastAim.current = { canvas:event.target, clientX:event.clientX, clientY:event.clientY }
            if (entered && !paused && !transition && !ending) applyPointerAim()
          }}
        >
          <Court rally={rally} progress={progress} aimCamera={aimCamera} attempt={attempt}
            bellReveal={bellReveal} onBellReveal={setBellRevealed}
            paused={paused} ritual={status.ritual} awake={introduced || !ready} entry={entry} onEntry={completeEntry} openingServe={openingServe} onServeSound={serveSound} onTouchStone={startEntry} stoneReady={worldReady} onWorldReady={showWorld} />
          {entered ? (
            <div className="garden-hud" inert={paused}>
              {ending ? (
                <aside className="volume-colophon" aria-labelledby="volume-title">
                  <p className="volume-series"><i aria-hidden="true" />禅球日历</p>
                  <h2>第一卷</h2>
                  <h3 id="volume-title">施主请打球</h3>
                </aside>
              ) : (
                <aside className="court-instructions" aria-labelledby="arrival-heading">
                  <div className="court-chapter">
                    <p className="chapter-label">{chapter}</p>
                    <h2 id="arrival-heading">{firstServe ? '把球送到对岸的莲心' : objective}</h2>
                    {firstServe && <p>「施主，请接球。」瞄花心，避开池水。</p>}
                    {cloudOpening && <p>等墨影回球。球边金环亮起时，打向亮纹。</p>}
                    <ol className="chapter-route" aria-label="本重进度">
                      {route.map((label,index) => <li key={label} data-step={index < routeStep ? 'complete' : index === routeStep ? 'current' : 'next'}
                        aria-current={index === routeStep ? 'step' : undefined}>{label}</li>)}
                    </ol>
                  </div>
                  {ready && !transition && !bellEmerging && <div className="court-input">
                    <span className="aim-guide"><GameIcon name="mouse" />鼠标{actionHint}</span>
                    <GameButton quiet keyHint="空格" className="garden-enter" onClick={(event) => {
                      event.currentTarget.blur()
                      stroke()
                    }}>发球</GameButton>
                  </div>}
                </aside>
              )}
              <div className="garden-feedback" hidden={ready || ending} data-fault={status.fault || undefined}
                data-timing={status.ritual === 'mountain' && status.phase === 'window' ? lateAtSeal ? 'late' : 'live' : undefined}
                data-phase={status.phase} data-quality={status.phase === 'outbound' ? status.quality : undefined}>
                <div className="feedback-message" role="status">
                  {status.phase === 'window' && !lateAtSeal && <strong className="feedback-label">现在回拍</strong>}
                  {status.phase === 'window' && !lateAtSeal && <kbd aria-label="按空格回球">空格</kbd>}
                  <span className="action-copy">{gardenPrompt}</span>
                </div>
                {status.fault && !transition &&
                  <GameButton icon="retry" keyHint="R" onClick={() => { audio.menu(); reset() }}>{mountainRetry ? '重试两道山纹' : '重试'}</GameButton>}
                <div ref={progress} className="timing" aria-hidden="true"><i /></div>
              </div>
              <footer className="garden-controls">
                <GameButton icon="pause" keyHint="Esc" onClick={() => togglePause(true)}>暂停</GameButton>
                {!transition && !status.fault && <GameButton icon={ending ? 'folio' : 'retry'} keyHint={ending ? undefined : 'R'} onClick={(event) => {
                  if (event.detail > 0) event.currentTarget.blur()
                  audio.menu()
                  reset(ending)
                }}>{ending ? '重新入画' : '重试'}</GameButton>}
              </footer>
            </div>
          ) : entry === 'painting' && (
            <div className="stone-prologue" inert={settingsOpen}>
              <h1 className="title-lockup"><GameWordmark /><small lang="en">ZENBALL · THE DIVINE RALLY</small></h1>
              <div className="home-actions">
                <GameButton primary aria-label="发球唤山" disabled={!worldReady}
                  onClick={(event) => { event.currentTarget.blur(); openingServe.current?.() }}>
                  {worldReady ? '发球唤山' : '灵石凝形中…'}
                </GameButton>
                <kbd aria-hidden="true">空格</kbd>
              </div>
              <GameButton ref={settingsLauncher} icon="settings" quiet className="home-settings"
                aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>设置</GameButton>
            </div>
          )}
          {assetWarning && !paused && entered && <div className="asset-note" role="status">部分画中物件未完整显现 · 可继续游玩</div>}
          {settingsOpen && <GameDialog title="设置">
            {soundControls}
            <GameButton icon="back" autoFocus keyHint="Esc" onClick={closeHomeSettings}>返回首页</GameButton>
          </GameDialog>}
          {paused && <GameDialog key={pauseSoundOpen ? 'sound' : 'pause'} title={pauseSoundOpen ? '声音' : '暂停'}>
            {pauseSoundOpen ? <>
              {soundControls}
              <GameButton icon="back" autoFocus keyHint="Esc" onClick={() => setPauseSoundOpen(false)}>返回暂停</GameButton>
            </> : <>
              <p className="pause-context">{chapter} · {status.fault ? faultText[status.fault] : objective}</p>
              {assetWarning && <p role="status">部分物件暂以临时形态显现，仍可继续游玩。重新载入可重试资源。</p>}
              <GameButton primary autoFocus keyHint="Esc" onClick={() => togglePause(false)}>继续</GameButton>
              <GameButton icon="sound" onClick={() => setPauseSoundOpen(true)}>声音</GameButton>
              {!ending && <GameButton icon="retry" disabled={transition} onClick={() => reset()}>重试当前挑战</GameButton>}
              <GameButton icon="folio" onClick={() => reset(true)}>重新入画</GameButton>
            </>}
          </GameDialog>}
        </section>
      </main>
    )
  }

  return (
    <main className="game">
      <header className="masthead">
        <div className="brand">
          <div className="wordmark">ZENBALL <span>· THE DIVINE RALLY</span></div>
          <h1>施主请接球</h1>
        </div>
        <div className="version">物理调试 <span>V0.4</span></div>
      </header>

      <div className="layout">
        <section className="court-panel" aria-label="3D 网球场"
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect()
            if (bounds.width > 0) {
              const horizontal = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
              rally.setAim(horizontal * COURT.aimLimit)
            }
          }}
        >
          <Court rally={rally} progress={progress} attempt={attempt} />
          <div className="court-key" aria-hidden="true">
            <span><i className="legend-dot player-dot" />你</span>
            <span><i className="legend-dot shadow-dot" />影子</span>
          </div>
          {(ready || ended) && (
            <div className="court-action">
              {ended && <strong>{goal ? '挑战完成' : '本轮结束'} · {prompt}</strong>}
              <button type="button" className="serve" onClick={(event) => {
                if (event.detail > 0) event.currentTarget.blur()
                if (ended) reset()
                stroke()
              }}>{ready ? '发球' : '重新发球'} {ready && <kbd>Space</kbd>}</button>
            </div>
          )}
        </section>

        <aside className="rail" aria-label="比分与操作">
          <div className="score-panel">
            <h2>连续回球</h2>
            <div className="count-row">
              <output aria-label="连续回球次数">{status.returns}</output>
              <span className="score-target">/ 3</span>
            </div>
            <div className="goal" data-complete={goal}>
              <div className="goal-marks" aria-hidden="true">
                {[1, 2, 3].map((n) => <i key={n} data-filled={status.returns >= n} />)}
              </div>
              <span role="status">{goal ? '已完成三连击' : '目标 · 三次有效回球'}</span>
            </div>
          </div>

          <div className="prompt-panel" data-phase={status.phase} role="status">
            <div className="prompt-title"><i aria-hidden="true" />{prompt}</div>
            <p>{detail}</p>
            <div ref={progress} className="timing" aria-hidden="true"><i /></div>
          </div>

          <dl className="controls">
            <div><dt>移动鼠标</dt><dd>瞄准远场绿圈</dd></div>
            <div><dt><kbd>Space</kbd></dt><dd>发球 / 提示亮时挥拍</dd></div>
          </dl>
          <button type="button" className="restart" onClick={(event) => {
            if (event.detail > 0) event.currentTarget.blur()
            reset()
          }}>重新开始 <kbd>R</kbd></button>
        </aside>
      </div>
    </main>
  )
}

class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="game-boot">
        <h1><GameWordmark /></h1>
        <p>画卷或场景暂时无法显示。请检查网络后重新载入画境。</p>
        <GameButton icon="retry" onClick={() => window.location.reload()}>重新加载</GameButton>
      </main>
    )
  }
}

function App() {
  const [game, setGame] = useState<{ rally: Rally; audio: RallySound } | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let resources: { rally: Rally; audio: RallySound } | undefined
    if (!debugCourt) preloadOpening()
    void Promise.all([initPhysics(), !debugCourt && prepareOpeningGeometry()]).then(() => {
      if (!active) return
      const audio = new RallySound()
      resources = { audio, rally: new Rally(audio.play, debugCourt ? 'court' : 'garden') }
      setGame(resources)
    }).catch((error: unknown) => {
      console.error('Rapier initialization failed', error)
      if (active) setFailed(true)
    })
    return () => {
      active = false
      resources?.rally.dispose()
      resources?.audio.dispose()
    }
  }, [])

  if (game) return <GameErrorBoundary><Game {...game} /></GameErrorBoundary>
  return (
    <main className="game-boot">
      <h1><GameWordmark /></h1>
      <p role="status">{failed ? '画境加载失败，请重新加载。' : '正在展开画境…'}</p>
      {failed && <GameButton icon="retry" onClick={() => window.location.reload()}>重新加载</GameButton>}
    </main>
  )
}

createRoot(document.getElementById('root')!).render(import.meta.env.DEV && new URLSearchParams(location.search).get('review')==='asset' ? <AssetReview/> : <App/>)
