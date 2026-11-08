import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PREFS_KEY } from '../game/constants'
import type { ThemeId } from '../game/types'
import { playSfx, setMusicEnabled, setSoundEnabled, unlockAudio } from '../game/audio'

interface PrefsStore {
  theme: ThemeId
  sound: boolean
  music: boolean
  setTheme: (theme: ThemeId) => void
  setSound: (sound: boolean) => void
  setMusic: (music: boolean) => void
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
    }),
    {
      name: PREFS_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          setSoundEnabled(state.sound)
          setMusicEnabled(state.music)
        }
      },
    },
  ),
)

export function syncPrefsToAudio(): void {
  const state = usePrefs.getState()
  setSoundEnabled(state.sound)
  setMusicEnabled(state.music)
}
