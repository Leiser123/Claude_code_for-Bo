import { api } from './client'

export interface WikiTranslateConfig {
  provider: 'google' | 'deepl' | 'deepseek' | 'baidu' | 'custom'
  apiKey: string
  apiSecret: string
  apiUrl: string
  model: string
}

const DEFAULT_CONFIG: WikiTranslateConfig = {
  provider: 'google',
  apiKey: '',
  apiSecret: '',
  apiUrl: '',
  model: '',
}

export const wikiTranslateConfigApi = {
  get: () =>
    api.get<WikiTranslateConfig>('/api/wiki/translate-config')
      .then((res) => ({ ...DEFAULT_CONFIG, ...res }))
      .catch(() => DEFAULT_CONFIG),

  save: (config: WikiTranslateConfig) =>
    api.put<{ success: boolean }>('/api/wiki/translate-config', config),
}
