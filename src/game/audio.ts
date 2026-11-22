import { createMusicPlayer, isMusicTrackId, type MusicPlayer, type MusicTrackId } from './music'

type SfxName = 'click' | 'roll' | 'success' | 'fail' | 'coin' | 'turn' | 'modal'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

let context: AudioContext | null = null
let master: GainNode | null = null
let soundEnabled = true
let musicEnabled = false
let musicPlayer: MusicPlayer | null = null
let musicTrack: MusicTrackId = 'happy'

/**
 * Output trim. Synth voices are authored well below full scale; this lifts the
 * mix to normal game levels while keeping stacked effects below clipping.
 */
const MASTER_GAIN = 1.5

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext
    if (!AudioCtor) return null
    context = new AudioCtor()
    master = context.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(context.destination)
    musicPlayer = createMusicPlayer(context, master)
    musicPlayer.setTrack(musicTrack)
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(
  frequency: number,
  duration: number,
  options: {
    type?: OscillatorType
    volume?: number
    delay?: number
    glideTo?: number
    pan?: number
    attack?: number
  } = {},
): void {
  if (!soundEnabled) return
  const ctx = ensureContext()
  if (!ctx || !master) return
  const start = ctx.currentTime + (options.delay ?? 0)
  const attack = Math.min(options.attack ?? 0.006, duration * 0.2)
  const peak = Math.max(0.0002, options.volume ?? 0.18)
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = options.type ?? 'sine'
  oscillator.frequency.setValueAtTime(frequency, start)
  if (options.glideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.glideTo),
      start + duration,
    )
  }
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + attack)
  gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + duration * 0.4)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  if (options.pan === undefined) {
    gain.connect(master)
  } else {
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, options.pan))
    gain.connect(panner)
    panner.connect(master)
  }
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
}

export function playSfx(name: SfxName): void {
  switch (name) {
    case 'click':
      tone(520, 0.06, { type: 'triangle', volume: 0.18, attack: 0.004 })
      break
    case 'roll':
      tone(340, 0.06, { type: 'square', volume: 0.1, pan: -0.25 })
      tone(410, 0.06, { type: 'square', volume: 0.1, delay: 0.07, pan: 0.25 })
      tone(300, 0.08, { type: 'square', volume: 0.1, delay: 0.15, pan: -0.1 })
      break
    case 'success':
      tone(523.25, 0.18, { type: 'triangle', volume: 0.22, pan: -0.2 })
      tone(659.25, 0.2, { type: 'triangle', volume: 0.2, delay: 0.1 })
      tone(783.99, 0.3, { type: 'triangle', volume: 0.18, delay: 0.2, pan: 0.2 })
      break
    case 'fail':
      tone(220, 0.2, { type: 'triangle', volume: 0.2, glideTo: 146.83 })
      tone(130, 0.3, { type: 'triangle', volume: 0.2, delay: 0.16, glideTo: 98 })
      break
    case 'coin':
      tone(1046.5, 0.12, { type: 'triangle', volume: 0.16, pan: 0.18 })
      tone(1318.5, 0.16, { type: 'triangle', volume: 0.14, delay: 0.06, pan: -0.18 })
      break
    case 'turn':
      tone(392, 0.22, { type: 'sine', volume: 0.18 })
      tone(523.25, 0.28, { type: 'sine', volume: 0.18, delay: 0.13 })
      break
    case 'modal':
      tone(660, 0.09, { type: 'sine', volume: 0.11 })
      break
  }
}

function startMusic(): void {
  if (!musicEnabled) return
  const ctx = ensureContext()
  if (!ctx) return
  musicPlayer?.start()
}

function stopMusic(): void {
  musicPlayer?.stop()
}

export function unlockAudio(): void {
  const ctx = ensureContext()
  if (!ctx) return
  if (musicEnabled) startMusic()
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
  if (enabled) playSfx('click')
}

export function setMusicTrack(track: MusicTrackId): void {
  if (!isMusicTrackId(track) || track === musicTrack) return
  musicTrack = track
  musicPlayer?.setTrack(track)
  if (musicEnabled) startMusic()
}

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled
  if (enabled) startMusic()
  else stopMusic()
}

export function getAudioEnabled(): { sound: boolean; music: boolean } {
  return { sound: soundEnabled, music: musicEnabled }
}
