import type { ProjectCategory, ProjectLifecycle } from '../../stores/projectStore'

export const CATEGORIES: ProjectCategory[] = ['WS', 'TS', 'PA', 'CA', '2WP']

export const CATEGORY_META: Record<ProjectCategory, { color: string; bg: string; gradient: [string, string] }> = {
  WS: { color: '#1d4ed8', bg: '#dbeafe', gradient: ['#3b82f6', '#1d4ed8'] },
  TS: { color: '#7c3aed', bg: '#ede9fe', gradient: ['#a855f7', '#7c3aed'] },
  PA: { color: '#15803d', bg: '#dcfce7', gradient: ['#22c55e', '#15803d'] },
  CA: { color: '#a16207', bg: '#fef9c3', gradient: ['#eab308', '#a16207'] },
  '2WP': { color: '#db2777', bg: '#fce7f3', gradient: ['#ec4899', '#db2777'] },
}

export const LIFECYCLE_META: Record<ProjectLifecycle, { label: string; color: string; bg: string }> = {
  in_development: { label: 'In Development', color: '#1d4ed8', bg: '#dbeafe' },
  completed: { label: 'Completed', color: '#15803d', bg: '#dcfce7' },
  on_hold: { label: 'On Hold', color: '#b91c1c', bg: '#fee2e2' },
}

export const DOC_META: Record<string, { icon: string; color: string }> = {
  pdf: { icon: 'picture_as_pdf', color: '#dc2626' },
  word: { icon: 'description', color: '#2563eb' },
  excel: { icon: 'table_chart', color: '#16a34a' },
  ppt: { icon: 'slideshow', color: '#ea580c' },
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
