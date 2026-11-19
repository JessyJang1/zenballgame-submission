import type { Cue } from './rally'

export type SoundScene = 'stone' | 'tunnel' | 'court' | 'gate' | 'ridge' | 'summit' | 'moon' | 'ending'

const soundscapes: Record<SoundScene, { air: number; cutoff: number; water: number; echo: number; motif: number[]; pace: number }> = {
  stone:  { air:.18, cutoff:310,  water:.012, echo:.14, motif:[196,0,294,0,220,0], pace:2.15 },
  tunnel: { air:.22, cutoff:235,  water:.025, echo:.25, motif:[196,0,146.83,0], pace:1.35 },
  court:  { air:.11, cutoff:490,  water:.067, echo:.13, motif:[196,293.66,0,329.63,220,0,293.66,0], pace:1.22 },
  gate:   { air:.24, cutoff:380,  water:.017, echo:.21, motif:[146.83,0,196,293.66], pace:.94 },
  ridge:  { air:.24, cutoff:1040, water:0,    echo:.07, motif:[220,329.63,392,0,329.63,0,293.66,0], pace:.95 },
  summit: { air:.26, cutoff:1280, water:0,    echo:.08, motif:[261.63,392,440,0,329.63,0], pace:1.30 },
  moon:   { air:.1,  cutoff:780,  water:0,    echo:.10, motif:[293.66,392,587.33,0], pace:1.70 },
  ending: { air:0,   cutoff:400,  water:0,    echo:.06, motif:[], pace:1.80 },
}
const menuSample = import.meta.env.BASE_URL + 'assets/audio/kenney-confirmation.wav'
type Tone = readonly [frequency: number, duration: number, volume: number, type: OscillatorType]

const tones: Record<Cue, Tone> = {
  serve: [340, 0.12, 0.14, 'triangle'],
  perfect: [585, 0.17, 0.14, 'triangle'],
  barrier: [175, 0.14, 0.15, 'triangle'],
  passage: [480, 0.29, 0.13, 'sine'],
  moonGate: [330, .65, .13, 'sine'],
  hit: [480, 0.13, 0.17, 'triangle'],
  shadow: [250, 0.09, 0.11, 'triangle'],
  bounce: [115, 0.075, 0.09, 'sine'],
  swish: [155, 0.07, 0.035, 'triangle'],
  target: [620, 0.23, 0.12, 'sine'],
  lotus: [720, 0.28, 0.10, 'sine'],
  bell: [208, 0.76, 0.19, 'sine'],
  seal: [392, .22, .095, 'sine'],
  mountain: [132, 1.22, .16, 'triangle'],
  fault: [105, 0.26, 0.11, 'triangle'],
  water: [315, .29, .095, 'sine'],
  contact: [720, .10, .065, 'sine'],
}

export class RallySound {
  private context?: AudioContext
  private master?: GainNode
  private musicBus?: GainNode
  private effectsBus?: GainNode
  private scoreLevel?: GainNode
  private echo?: GainNode
  private air?: AudioBufferSourceNode
  private airLevel?: GainNode
  private airFilter?: BiquadFilterNode
  private waterLevel?: GainNode
  private muted = false
  private music = .72
  private effects = .85
  private paused = false
  private place: SoundScene = 'stone'
  private note = 0
  private nextNote = 0
  private scoreTimer?: ReturnType<typeof setInterval>
  private interfaceSound?: AudioBuffer

  pause(value: boolean) {
    this.paused = value
    const ctx = this.context
    if (!ctx || ctx.state === 'closed') return
    if (value) void ctx.suspend().catch(() => {})
    else void ctx.resume().catch(() => {})
  }

  landscape(place: SoundScene) {
    const changed = this.place !== place
    this.place = place
    const ctx = this.context
    if (!ctx || !this.airLevel || !this.airFilter || !this.waterLevel || !this.echo || !this.scoreLevel) return
    const { air, cutoff, water, echo } = soundscapes[place]
    const now = ctx.currentTime
    this.airFilter.frequency.setTargetAtTime(cutoff, now, .55)
    this.airLevel.gain.setTargetAtTime(air, now, .64)
    this.waterLevel.gain.setTargetAtTime(water, now, .75)
    this.echo.gain.setTargetAtTime(echo, now, .48)
    this.scoreLevel.gain.setTargetAtTime(place === 'ending' ? .34 : 1, now, .5)
    if (!changed) return
    this.note = 0
    this.nextNote = now + .38
    if (place === 'gate') {
      this.tone(ctx, [90, .72, .045, 'triangle'], 0)
      this.tone(ctx, [137, 1.2, .035, 'sine'], .24)
    }
  }

  setMix(music: number, effects: number) {
    this.music = music
    this.effects = effects
    if (!this.context) return
    this.musicBus?.gain.setTargetAtTime(music, this.context.currentTime, .018)
    this.effectsBus?.gain.setTargetAtTime(effects, this.context.currentTime, .018)
  }

  setMuted(value: boolean) {
    this.muted = value
    if (this.context && this.master) this.master.gain.setTargetAtTime(value ? 0 : 1, this.context.currentTime, .015)
  }

  unlock() {
    try {
      if (!this.context) this.createMix()
      const ctx = this.context
      if (ctx && !this.paused && ctx.state !== 'running') void ctx.resume().catch(() => {})
    } catch {
      // Visual feedback is always available.
    }
  }

  private createMix() {
    const ctx = new AudioContext()
    this.context = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 1
    this.master.connect(ctx.destination)
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -15
    compressor.ratio.value = 3
    compressor.connect(this.master)

    this.effectsBus = ctx.createGain()
    this.effectsBus.gain.value = this.effects
    this.effectsBus.connect(compressor)
    const reflection = ctx.createDelay(.16)
    reflection.delayTime.value = .103
    const damping = ctx.createBiquadFilter()
    damping.frequency.value = 1840
    this.echo = ctx.createGain()
    this.effectsBus.connect(reflection).connect(damping).connect(this.echo).connect(compressor)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.music
    this.musicBus.connect(compressor)
    this.scoreLevel = ctx.createGain()
    this.scoreLevel.connect(this.musicBus)

    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    let previous = 0
    for (let i = 0; i < samples.length; i++) {
      previous = previous * .82 + (Math.random() * 2 - 1) * .18
      samples[i] = previous * Math.min(1, i / 512, (samples.length - i - 1) / 512)
    }
    this.air = ctx.createBufferSource()
    this.air.buffer = buffer
    this.air.loop = true
    this.airFilter = ctx.createBiquadFilter()
    this.airLevel = ctx.createGain()
    this.airLevel.gain.value = 0
    this.air.connect(this.airFilter).connect(this.airLevel).connect(this.effectsBus)
    const waterFilter = ctx.createBiquadFilter()
    waterFilter.type = 'bandpass'
    waterFilter.frequency.value = 1150
    this.waterLevel = ctx.createGain()
    this.waterLevel.gain.value = 0
    this.air.connect(waterFilter).connect(this.waterLevel).connect(this.effectsBus)
    this.air.start()
    this.landscape(this.place)
    this.nextNote = ctx.currentTime + .40
    this.scoreTimer = setInterval(this.score, 150)
    void fetch(menuSample)
      .then(response => response.ok ? response.arrayBuffer() : Promise.reject(new Error('UI audio unavailable')))
      .then(bytes => ctx.decodeAudioData(bytes))
      .then(buffer => { this.interfaceSound = buffer })
      .catch(() => {})
  }

  private score = () => {
    const ctx = this.context
    if (!ctx || !this.scoreLevel || this.paused || ctx.state !== 'running') return
    const { motif, pace } = soundscapes[this.place]
    if (motif.length === 0 || this.nextNote > ctx.currentTime + .19) return
    const time = Math.max(this.nextNote, ctx.currentTime + .015)
    const pitch = motif[this.note % motif.length]
    if (pitch) this.pluck(ctx, pitch, time, this.scoreLevel, .045)
    if (this.note % 4 === 0) this.pluck(ctx, motif[0] / 2, time + .09, this.scoreLevel, .026)
    this.note++
    this.nextNote = time + pace
  }

  private pluck(ctx: AudioContext, pitch: number, time: number, bus: GainNode, level: number) {
    const partials = [[1,1,1.45],[2,.3,.58],[3.01,.14,.24]] as const
    for (const [ratio, strength, tail] of partials) {
      this.tone(ctx, [pitch * ratio, tail, strength * level, 'sine'], time - ctx.currentTime, bus, 1)
    }
  }

  menu() {
    this.unlock()
    const ctx = this.context
    if (!ctx || !this.effectsBus || this.muted) return
    if (!this.interfaceSound) {
      this.tone(ctx, [430,.07,.055,'sine'], 0)
      return
    }
    const source = ctx.createBufferSource()
    source.buffer = this.interfaceSound
    const level = ctx.createGain()
    level.gain.value = .19
    source.connect(level).connect(this.effectsBus)
    source.onended = () => { source.disconnect(); level.disconnect() }
    source.start()
  }

  play = (cue: Cue) => {
    const context = this.context
    if (!context || !this.master || this.muted || context.state === 'closed') return
    this.tone(context, tones[cue], 0)
    if (cue === 'serve' || cue === 'hit' || cue === 'perfect' || cue === 'shadow') {
      this.tone(context, [cue === 'shadow' ? 168 : 235, .057, .18, 'triangle'], 0)
      this.tone(context, [1350, .034, .065, 'sine'], .002)
    }
    if (cue === 'bell') {
      this.tone(context, [317, 1.65, .085, 'sine'], .02, this.effectsBus, .99)
      this.tone(context, [601, 1.22, .045, 'sine'], .034, this.effectsBus, 1)
    }
    if (cue === 'water') this.tone(context, [168, .33, .052, 'sine'], .065)
    if (cue === 'perfect') this.tone(context, [960, 0.13, 0.07, 'sine'], 0.027)
    if (cue === 'passage') this.tone(context, [720, 0.39, 0.10, 'sine'], 0.10)
    if (cue === 'moonGate') {
      this.tone(context, [660, .68, .08, 'sine'], .13)
      this.tone(context, [990, .91, .05, 'sine'], .27)
    }
    if (cue === 'target') this.tone(context, [830, 0.26, 0.10, 'sine'], 0.11)
    if (cue === 'lotus') {
      this.tone(context, [392, 0.24, 0.038, 'sine'], .32)
      this.tone(context, [294, 0.48, 0.056, 'sine'], .75)
    }
    if (cue === 'bell') this.tone(context, [523, 0.58, 0.09, 'sine'], 0.08)
    if (cue === 'seal') this.tone(context, [588, .33, .057, 'sine'], .078)
    if (cue === 'mountain') this.tone(context, [266, 1.06, .08, 'sine'], .12)
  }

  closeVolume() {
    const ctx = this.context
    if (!ctx || !this.scoreLevel || ctx.state === 'closed') return
    this.pluck(ctx, 392, ctx.currentTime + .05, this.scoreLevel, .085)
    this.pluck(ctx, 293.66, ctx.currentTime + .38, this.scoreLevel, .087)
    this.pluck(ctx, 196, ctx.currentTime + .74, this.scoreLevel, .14)
  }

  wakeStone() {
    this.unlock()
    const ctx = this.context
    if (!ctx || !this.effectsBus || ctx.state === 'closed') return
    this.tone(ctx, [196, 1.8, .10, 'sine'], 0)
    this.tone(ctx, [401, 1.18, .035, 'sine'], .06)
    this.tone(ctx, [73, .65, .042, 'triangle'], .27)
  }

  private tone(ctx: AudioContext, [frequency, duration, volume, type]: Tone, delay: number, output = this.effectsBus, glide = .56) {
    if (!output) return
    const start = ctx.currentTime + Math.max(0, delay)
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    if (glide !== 1) oscillator.frequency.exponentialRampToValueAtTime(frequency * glide, start + duration)
    gain.gain.setValueAtTime(.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + .009)
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration)
    oscillator.connect(gain).connect(output)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + duration)
  }

  dispose() {
    clearInterval(this.scoreTimer)
    this.air?.stop()
    this.air?.disconnect()
    if (this.context) void this.context.close().catch(() => {})
  }
}
