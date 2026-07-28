import { create } from 'zustand'
import { api } from '../api/client'

interface TranslateState {
  fromLang: string
  toLang: string
  isTranslated: boolean
  translating: boolean
  translatedContent: string | null
  translatedHTML: string | null
  translateError: string | null
  setFromLang: (lang: string) => void
  setToLang: (lang: string) => void
  toggleTranslate: () => void
  resetTranslate: () => void
  clearTranslation: () => void
  translatePage: (path: string, content?: string) => Promise<void>
  cancelTranslate: () => void
}

let abortController: AbortController | null = null

export const useTranslateStore = create<TranslateState>((set, get) => ({
  fromLang: 'en',
  toLang: 'zh',
  isTranslated: false,
  translating: false,
  translatedContent: null,
  translatedHTML: null,
  translateError: null,

  setFromLang: (lang) => set({ fromLang: lang }),
  setToLang: (lang) => set({ toLang: lang }),
  toggleTranslate: () => set((s) => ({ isTranslated: !s.isTranslated })),
  resetTranslate: () => set({ isTranslated: false, translatedContent: null, translatedHTML: null, translateError: null }),
  clearTranslation: () => set({ translatedContent: null, translatedHTML: null, isTranslated: false, translateError: null }),

  translatePage: async (path) => {
    if (abortController) {
      return
    }
    abortController = new AbortController()
    set({ translating: true, translateError: null })
    try {
      const { fromLang, toLang } = get()
      const data = await api.get<{ html: string }>(
        `/api/wiki/translate?path=${encodeURIComponent(path)}&to=${toLang}${fromLang ? `&from=${fromLang}` : ''}`,
        { signal: abortController.signal, timeout: 300_000 },
      )
      set({ translatedHTML: data.html, translatedContent: data.html, isTranslated: true, translateError: null })
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        set({ translateError: null, isTranslated: false })
      } else {
        const message = err instanceof Error ? err.message : String(err)
        set({ translateError: message, isTranslated: false })
      }
    } finally {
      abortController = null
      set({ translating: false })
    }
  },

  cancelTranslate: () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  },
}))
