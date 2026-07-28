import { create } from 'zustand'

interface PanelState {
  isAuditOpen: boolean
  isOutlineOpen: boolean
  isAuditCollapsed: boolean
  isChatCollapsed: boolean
  openAudit: () => void
  closeAudit: () => void
  toggleAudit: () => void
  openOutline: () => void
  closeOutline: () => void
  toggleOutline: () => void
  toggleAuditPanel: () => void
  toggleChatPanel: () => void
}

export const usePanelStore = create<PanelState>((set) => ({
  isAuditOpen: false,
  isOutlineOpen: true,
  isAuditCollapsed: false,
  isChatCollapsed: false,

  openAudit: () => set({ isAuditOpen: true, isAuditCollapsed: false }),
  closeAudit: () => set({ isAuditOpen: false }),
  toggleAudit: () => set((state) => ({ isAuditOpen: !state.isAuditOpen, isAuditCollapsed: false })),

  openOutline: () => set({ isOutlineOpen: true, isChatCollapsed: false }),
  closeOutline: () => set({ isOutlineOpen: false }),
  toggleOutline: () => set((state) => ({ isOutlineOpen: !state.isOutlineOpen, isChatCollapsed: false })),

  toggleAuditPanel: () => set((state) => ({ isAuditCollapsed: !state.isAuditCollapsed })),
  toggleChatPanel: () => set((state) => ({ isChatCollapsed: !state.isChatCollapsed })),
}))
