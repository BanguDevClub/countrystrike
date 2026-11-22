export type MusicTrackId = 'happy' | 'industrial' | 'dark'

export interface MusicTrackInfo {
  id: MusicTrackId
  name: string
  tagline: string
}

export const MUSIC_TRACKS: readonly MusicTrackInfo[] = [
  { id: 'happy', name: 'Bright Horizon', tagline: 'Major-key momentum' },
  { id: 'industrial', name: 'Industrial Pulse', tagline: 'Mechanical and driving' },
  { id: 'dark', name: 'Dark Empire', tagline: 'Slow, imperial, ominous' },
]

interface Song {
  ctx: AudioContext
  bus: AudioNode
  noise: AudioBuffer
  stepDuration: number
}

type Scheduler = (song: Song, step: number, time: number) => void

interface TrackSpec {
  bpm: number
  level: number
  schedule: Scheduler
}

interface NoteOptions {
  type?: OscillatorType
  volume?: number
  attack?: number
  release?: number
  pan?: number
  filter?: number
  glideTo?: number
  detune?: number
}

interface NoiseOptions {
  volume?: number
  filter?: BiquadFilterType
  frequency?: number
  q?: number
  pan?: number
  attack?: number
}

const BAR_STEPS = 8
const BARS = 4
const TOTAL_STEPS = BAR_STEPS * BARS
const TICK_MS = 25
const SCHEDULE_AHEAD = 0.12

const HAPPY_CHORDS: readonly number[][] = [
  [261.63, 329.63, 392.0, 523.25],
  [392.0, 493.88, 587.33, 783.99],
  [220.0, 261.63, 329.63, 440.0],
  [349.23, 440.0, 523.25, 698.46],
]
const HAPPY_BASS = [130.81, 98.0, 110.0, 87.31]
const HAPPY_ARP = [0, 1, 2, 3, 2, 1, 2, 3]

const INDUSTRIAL_ROOTS = [164.81, 130.81, 196.0, 146.83]
const INDUSTRIAL_BASS = [0, 0, 7, 0, 3, 0, 10, 7]

const DARK_CHORDS: readonly number[][] = [
  [146.83, 174.61, 220.0, 293.66],
  [116.54, 146.83, 174.61, 233.08],
  [98.0, 117.83, 146.83, 196.0],
  [110.0, 138.59, 164.81, 220.0],
]
const DARK_MOTIF = [293.66, 311.13, 293.66, 220.0]

function note(
  song: Song,
  frequency: number,
  time: number,
  duration: number,
  options: NoteOptions = {},
): void {
  const { ctx } = song
  const oscillator = ctx.createOscillator()
  oscillator.type = options.type ?? 'triangle'
  oscillator.frequency.setValueAtTime(frequency, time)
  oscillator.detune.value = options.detune ?? 0
  if (options.glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.glideTo),
      time + duration,
    )
  }
  const gain = ctx.createGain()
  const volume = Math.max(0.0002, options.volume ?? 0.06)
  const attack = Math.min(options.attack ?? 0.006, duration * 0.5)
  const release = Math.min(options.release ?? duration * 0.35, duration - attack)
  const hold = Math.max(time + attack, time + duration - release)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.linearRampToValueAtTime(volume, time + attack)
  gain.gain.exponentialRampToValueAtTime(volume * 0.6, hold)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  if (options.filter !== undefined) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = options.filter
    filter.Q.value = 0.7
    oscillator.connect(filter)
    filter.connect(gain)
  } else {
    oscillator.connect(gain)
  }
  if (options.pan === undefined) {
    gain.connect(song.bus)
  } else {
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, options.pan))
    gain.connect(panner)
    panner.connect(song.bus)
  }
  oscillator.start(time)
  oscillator.stop(time + duration + 0.05)
}

function noise(song: Song, time: number, duration: number, options: NoiseOptions = {}): void {
  const { ctx } = song
  const source = ctx.createBufferSource()
  source.buffer = song.noise
  const filter = ctx.createBiquadFilter()
  filter.type = options.filter ?? 'highpass'
  filter.frequency.value = options.frequency ?? 6000
  filter.Q.value = options.q ?? 0.7
  const gain = ctx.createGain()
  const volume = Math.max(0.0002, options.volume ?? 0.06)
  const attack = Math.min(options.attack ?? 0.002, duration * 0.3)
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(volume, time + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
  source.connect(filter)
  filter.connect(gain)
  if (options.pan === undefined) {
    gain.connect(song.bus)
  } else {
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, options.pan))
    gain.connect(panner)
    panner.connect(song.bus)
  }
  source.start(time)
  source.stop(time + duration + 0.01)
}

function kick(song: Song, time: number, volume: number, from = 150, to = 45, tail = 0.3): void {
  const { ctx } = song
  const oscillator = ctx.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(from, time)
  oscillator.frequency.exponentialRampToValueAtTime(to, time + Math.min(0.2, tail * 0.5))
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + tail)
  oscillator.connect(gain)
  gain.connect(song.bus)
  oscillator.start(time)
  oscillator.stop(time + tail + 0.02)
}

function hat(song: Song, time: number, volume: number, pan = 0): void {
  noise(song, time, 0.035, { volume, filter: 'highpass', frequency: 7800, pan })
}

function snare(song: Song, time: number, volume: number): void {
  noise(song, time, 0.15, { volume, filter: 'bandpass', frequency: 1700, q: 0.9 })
  note(song, 190, time, 0.09, {
    type: 'triangle',
    volume: volume * 0.35,
    attack: 0.002,
    release: 0.07,
  })
}

function clank(song: Song, time: number, volume: number): void {
  noise(song, time, 0.12, { volume, filter: 'bandpass', frequency: 3200, q: 2.4 })
  note(song, 1567.98, time, 0.22, {
    type: 'triangle',
    volume: volume * 0.8,
    attack: 0.002,
    release: 0.2,
    pan: 0.3,
  })
}

function scheduleHappy(song: Song, step: number, time: number): void {
  const bar = Math.floor(step / BAR_STEPS) % BARS
  const beat = step % BAR_STEPS
  const chord = HAPPY_CHORDS[bar]!
  const root = HAPPY_BASS[bar]!
  const stepDuration = song.stepDuration

  if (beat === 0 || beat === 4) kick(song, time, 0.22)
  if (beat === 2 || beat === 6) snare(song, time, 0.06)
  hat(song, time, beat % 2 === 0 ? 0.035 : 0.055)

  if (beat === 0 || beat === 3 || beat === 4 || beat === 7) {
    note(song, root, time, stepDuration * 0.85, {
      type: 'sine',
      volume: 0.12,
      attack: 0.006,
    })
  }
  if (beat === 6) {
    note(song, root * 2, time, stepDuration * 0.5, { type: 'sine', volume: 0.06 })
  }

  note(song, chord[HAPPY_ARP[beat]!]! * 2, time, stepDuration * 1.15, {
    type: 'triangle',
    volume: 0.04,
    attack: 0.004,
    release: stepDuration * 0.55,
    pan: beat % 2 === 0 ? -0.28 : 0.28,
  })

  if (beat === 0) {
    chord.forEach((frequency, index) => {
      note(song, frequency, time, stepDuration * BAR_STEPS + 0.5, {
        type: 'triangle',
        volume: 0.018,
        attack: 0.18,
        release: 0.5,
        pan: (index - 1.5) * 0.24,
        filter: 2600,
      })
    })
  }
  if (beat === 7 && bar % 2 === 1) {
    note(song, chord[3]! * 2, time, stepDuration, {
      type: 'sine',
      volume: 0.025,
      attack: 0.002,
      pan: 0.4,
    })
  }
}

function scheduleIndustrial(song: Song, step: number, time: number): void {
  const bar = Math.floor(step / BAR_STEPS) % BARS
  const beat = step % BAR_STEPS
  const root = INDUSTRIAL_ROOTS[bar]!
  const stepDuration = song.stepDuration

  if (beat === 0 || beat === 3 || beat === 4 || beat === 6) {
    kick(song, time, beat === 0 ? 0.26 : 0.19)
  }
  if (beat === 2 || beat === 6) snare(song, time, 0.07)
  hat(song, time, beat % 2 === 0 ? 0.025 : 0.04, beat % 2 === 0 ? -0.2 : 0.2)
  if (beat === 5) clank(song, time, 0.025)

  const semitone = INDUSTRIAL_BASS[beat]!
  const bass = (root / 2) * 2 ** (semitone / 12)
  note(song, bass, time, stepDuration * 0.8, {
    type: 'sawtooth',
    volume: 0.08,
    attack: 0.004,
    release: stepDuration * 0.5,
    filter: 420,
    pan: beat % 2 === 0 ? -0.1 : 0.1,
  })

  if (beat === 0) {
    const chord = [0, 3, 7]
    chord.forEach((interval, index) => {
      note(song, root * 2 ** (interval / 12), time, stepDuration * BAR_STEPS + 0.5, {
        type: 'sawtooth',
        volume: 0.014,
        attack: 0.25,
        release: 0.5,
        filter: 900,
        pan: (index - 1) * 0.2,
      })
    })
  }
}

function scheduleDark(song: Song, step: number, time: number): void {
  const bar = Math.floor(step / BAR_STEPS) % BARS
  const beat = step % BAR_STEPS
  const chord = DARK_CHORDS[bar]!
  const root = chord[0]!
  const stepDuration = song.stepDuration

  if (beat === 0 || beat === 4) {
    kick(song, time, beat === 0 ? 0.23 : 0.18, 90, 48, 0.75)
  }

  if (beat === 0) {
    chord.forEach((frequency, index) => {
      note(song, frequency, time, stepDuration * BAR_STEPS + 0.9, {
        type: index === 0 ? 'sawtooth' : 'triangle',
        volume: index === 0 ? 0.05 : 0.04,
        attack: 0.6,
        release: 0.9,
        filter: 700,
        detune: (index - 1.5) * 6,
        pan: (index - 1.5) * 0.25,
      })
    })
  }

  if (beat === 0 || beat === 3) {
    const stab = [root, root * 1.5, root * 2]
    stab.forEach((frequency, index) => {
      note(song, frequency, time, stepDuration * 2.2, {
        type: 'sawtooth',
        volume: 0.04 / (index + 1),
        attack: 0.05,
        release: 0.7,
        filter: 520,
        pan: (index - 1) * 0.16,
      })
    })
  }

  if ((bar === 0 || bar === 2) && beat % 2 === 0) {
    note(song, DARK_MOTIF[beat / 2]!, time, stepDuration * 1.2, {
      type: 'sawtooth',
      volume: 0.04,
      attack: 0.06,
      release: stepDuration * 0.6,
      filter: 1100,
      pan: -0.15,
    })
  }

  if (beat === 6) {
    note(song, root / 2, time, stepDuration * 0.9, {
      type: 'sine',
      volume: 0.06,
      attack: 0.02,
      release: stepDuration * 0.5,
    })
  }

  if (beat === 6 && bar % 2 === 0) {
    note(song, chord[3]! * 2, time, stepDuration * 1.8, {
      type: 'sine',
      volume: 0.022,
      attack: 0.01,
      release: 1.2,
      pan: 0.3,
    })
  }
}

const TRACKS: Record<MusicTrackId, TrackSpec> = {
  happy: { bpm: 122, level: 0.5, schedule: scheduleHappy },
  industrial: { bpm: 108, level: 0.7, schedule: scheduleIndustrial },
  dark: { bpm: 72, level: 0.64, schedule: scheduleDark },
}

interface PlayerState {
  bus: GainNode
  song: Song
  timer: number
  step: number
  nextTime: number
  stepDuration: number
  schedule: Scheduler
}

export interface MusicPlayer {
  start: () => void
  stop: () => void
  setTrack: (track: MusicTrackId) => void
}

export function isMusicTrackId(value: unknown): value is MusicTrackId {
  return typeof value === 'string' && Object.hasOwn(TRACKS, value)
}

export function createMusicPlayer(ctx: AudioContext, destination: AudioNode): MusicPlayer {
  let state: PlayerState | null = null
  let current: MusicTrackId = 'happy'
  let noiseBuffer: AudioBuffer | null = null

  const getNoise = (): AudioBuffer => {
    if (noiseBuffer) return noiseBuffer
    const length = Math.floor(ctx.sampleRate * 0.5)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1
    noiseBuffer = buffer
    return buffer
  }

  const advance = (playerState: PlayerState): void => {
    if (playerState.nextTime < ctx.currentTime - 0.5) {
      playerState.nextTime = ctx.currentTime + 0.05
    }
    while (playerState.nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      playerState.schedule(playerState.song, playerState.step, playerState.nextTime)
      playerState.nextTime += playerState.stepDuration
      playerState.step = (playerState.step + 1) % TOTAL_STEPS
    }
  }

  const start = (): void => {
    if (state) return
    const spec = TRACKS[current]
    const bus = ctx.createGain()
    const now = ctx.currentTime
    bus.gain.setValueAtTime(0.0001, now)
    bus.gain.exponentialRampToValueAtTime(spec.level, now + 1.4)
    bus.connect(destination)
    const song: Song = {
      ctx,
      bus,
      noise: getNoise(),
      stepDuration: 30 / spec.bpm,
    }
    const playerState: PlayerState = {
      bus,
      song,
      timer: 0,
      step: 0,
      nextTime: now + 0.08,
      stepDuration: song.stepDuration,
      schedule: spec.schedule,
    }
    state = playerState
    advance(playerState)
    playerState.timer = window.setInterval(() => {
      if (state === playerState) advance(playerState)
    }, TICK_MS)
  }

  const stop = (): void => {
    if (!state) return
    const dying = state
    state = null
    window.clearInterval(dying.timer)
    const now = ctx.currentTime
    const gain = dying.bus.gain
    gain.cancelScheduledValues(now)
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now)
    gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    window.setTimeout(() => dying.bus.disconnect(), 900)
  }

  return {
    start,
    stop,
    setTrack: (track) => {
      if (track === current) return
      current = track
      if (state) {
        stop()
        start()
      }
    },
  }
}
