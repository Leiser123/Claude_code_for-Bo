import { api } from './client'
import type { ExpertConfig } from '../stores/projectStore'

export type MeetingTemplateApi = {
  id: string
  name: string
  agenda: string[]
  createdAt: number
}

export type ExpertSettingsPayload = {
  version: number
  experts: ExpertConfig[]
  projectManagerId: string | null
  meetingTemplates: MeetingTemplateApi[]
}

// 专家配置固化到 ~/.claude/cc-haha/expert-settings/settings.json
export const expertSettingsApi = {
  get: () => api.get<ExpertSettingsPayload>('/api/expert-settings'),
  save: (payload: Omit<ExpertSettingsPayload, 'version'>) =>
    api.post<ExpertSettingsPayload>('/api/expert-settings', { version: 1, ...payload }),
}
