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
let musicNodes: { oscillators: OscillatorNode[]; gain: GainNode; interval: number } | null = null

const CHORDS: number[][] = [
  [130.81, 164.81, 196.0, 246.94],
  [110.0, 146.83, 174.61, 220.0],
  [98.0, 130.81, 164.81, 196.0],
  [116.54, 146.83, 174.61, 233.08],
]

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext
    if (!AudioCtor) return null
    context = new AudioCtor()
    master = context.createGain()
    master.gain.value = 0.5
    master.connect(context.destination)
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

function tone(
  frequency: number,
  duration: number,
  options: { type?: OscillatorType; volume?: number; delay?: number; glideTo?: number } = {},
): void {
  if (!soundEnabled) return
  const ctx = ensureContext()
  if (!ctx || !master) return
  const start = ctx.currentTime + (options.delay ?? 0)
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
  gain.gain.exponentialRampToValueAtTime(options.volume ?? 0.035, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(master)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
}

export function playSfx(name: SfxName): void {
  switch (name) {
    case 'click':
      tone(520, 0.055, { type: 'triangle', volume: 0.018 })
      break
    case 'roll':
      tone(340, 0.05, { type: 'square', volume: 0.012 })
      tone(410, 0.05, { type: 'square', volume: 0.012, delay: 0.07 })
      tone(300, 0.07, { type: 'square', volume: 0.012, delay: 0.15 })
      break
    case 'success':
      tone(523.25, 0.16, { type: 'triangle', volume: 0.03 })
      tone(659.25, 0.18, { type: 'triangle', volume: 0.03, delay: 0.1 })
      tone(783.99, 0.28, { type: 'triangle', volume: 0.028, delay: 0.2 })
      break
    case 'fail':
      tone(220, 0.18, { type: 'sine', volume: 0.03, glideTo: 146.83 })
      tone(130, 0.28, { type: 'sine', volume: 0.022, delay: 0.16, glideTo: 98 })
      break
    case 'coin':
      tone(1046.5, 0.1, { type: 'triangle', volume: 0.02 })
      tone(1318.5, 0.14, { type: 'triangle', volume: 0.018, delay: 0.06 })
      break
    case 'turn':
      tone(392, 0.2, { type: 'sine', volume: 0.022 })
      tone(523.25, 0.26, { type: 'sine', volume: 0.022, delay: 0.13 })
      break
    case 'modal':
      tone(660, 0.08, { type: 'sine', volume: 0.014 })
      break
  }
}

function stopMusic(): void {
  if (!musicNodes) return
  window.clearInterval(musicNodes.interval)
  const { oscillators, gain } = musicNodes
  const ctx = ensureContext()
  if (ctx) {
    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8)
    for (const oscillator of oscillators) {
      try {
        oscillator.stop(ctx.currentTime + 0.9)
      } catch {
        // Oscillator may already be stopped.
      }
    }
  }
  musicNodes = null
}

function startMusic(): void {
  if (!musicEnabled || musicNodes) return
  const ctx = ensureContext()
  if (!ctx || !master) return
  const musicGain = ctx.createGain()
  musicGain.gain.value = 0.0001
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 760
  filter.Q.value = 0.6
  musicGain.connect(filter)
  filter.connect(master)
  const oscillators: OscillatorNode[] = []
  const chord = CHORDS[0]!
  for (const [index, frequency] of chord.entries()) {
    const oscillator = ctx.createOscillator()
    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle'
    oscillator.frequency.value = frequency
    oscillator.detune.value = (index - 1.5) * 4
    const voiceGain = ctx.createGain()
    voiceGain.gain.value = 0.016 / (index + 1)
    oscillator.connect(voiceGain)
    voiceGain.connect(musicGain)
    oscillator.start()
    oscillators.push(oscillator)
  }
  musicGain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2.5)
  let chordIndex = 0
  const interval = window.setInterval(() => {
    if (!musicEnabled || !context) return
    chordIndex = (chordIndex + 1) % CHORDS.length
    const next = CHORDS[chordIndex]!
    const now = context.currentTime
    oscillators.forEach((oscillator, index) => {
      oscillator.frequency.cancelScheduledValues(now)
      oscillator.frequency.linearRampToValueAtTime(next[index] ?? next[0]!, now + 2.8)
    })
  }, 9_000)
  musicNodes = { oscillators, gain: musicGain, interval }
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

export function setMusicEnabled(enabled: boolean): void {
  musicEnabled = enabled
  if (enabled) startMusic()
  else stopMusic()
}

export function getAudioEnabled(): { sound: boolean; music: boolean } {
  return { sound: soundEnabled, music: musicEnabled }
}
