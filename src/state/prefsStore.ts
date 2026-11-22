import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PREFS_KEY } from '../game/constants'
import type { ThemeId } from '../game/types'
import { isMusicTrackId, type MusicTrackId } from '../game/music'
import {
  playSfx,
  setMusicEnabled,
  setMusicTrack as applyMusicTrack,
  setSoundEnabled,
  unlockAudio,
} from '../game/audio'

interface PrefsStore {
  theme: ThemeId
  sound: boolean
  music: boolean
  musicTrack: MusicTrackId
  setTheme: (theme: ThemeId) => void
  setSound: (sound: boolean) => void
  setMusic: (music: boolean) => void
  setMusicTrack: (track: MusicTrackId) => void
}

function applyTheme(theme: ThemeId): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme
}

export const usePrefs = create<PrefsStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sound: true,
      music: false,
      musicTrack: 'happy',

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
        playSfx('click')
      },

      setSound: (sound) => {
        setSoundEnabled(sound)
        set({ sound })
      },

      setMusic: (music) => {
        unlockAudio()
        setMusicEnabled(music)
        set({ music })
      },

      setMusicTrack: (track) => {
        applyMusicTrack(track)
        set({ musicTrack: track })
      },
    }),
    {
      name: PREFS_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          setSoundEnabled(state.sound)
          if (isMusicTrackId(state.musicTrack)) applyMusicTrack(state.musicTrack)
          setMusicEnabled(state.music)
        }
      },
    },
  ),
)

export function syncPrefsToAudio(): void {
  const state = usePrefs.getState()
  if (isMusicTrackId(state.musicTrack)) applyMusicTrack(state.musicTrack)
  setSoundEnabled(state.sound)
  setMusicEnabled(state.music)
}
