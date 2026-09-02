import { create } from 'zustand'

export interface FileEntry {
  name: string
  relPath: string
  isDirectory: boolean
  size: number
}

interface ImportState {
  isOpen: boolean
  files: FileEntry[]
  selectedFile: FileEntry | null
  folderPath: string
  targetWiki: string
  targetFolder: string
  setOpen: (open: boolean) => void
  setFiles: (files: FileEntry[]) => void
  setSelectedFile: (file: FileEntry | null) => void
  setFolderPath: (path: string) => void
  setTargetWiki: (wiki: string) => void
  setTargetFolder: (folder: string) => void
  removeFile: (relPath: string) => void
  reset: () => void
}

export const useImportStore = create<ImportState>((set) => ({
  isOpen: false,
  files: [],
  selectedFile: null,
  folderPath: 'No folder selected',
  targetWiki: '',
  targetFolder: '',
  setOpen: (open) => set({ isOpen: open }),
  setFiles: (files) => set({ files }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  setFolderPath: (path) => set({ folderPath: path }),
  setTargetWiki: (wiki) => set({ targetWiki: wiki }),
  setTargetFolder: (folder) => set({ targetFolder: folder }),
  removeFile: (relPath: string) => set((state) => ({
    files: state.files.filter(f => f.relPath !== relPath),
    selectedFile: state.selectedFile?.relPath === relPath ? null : state.selectedFile,
  })),
  reset: () => set({ files: [], selectedFile: null, folderPath: 'No folder selected', targetWiki: '', targetFolder: '' }),
}))
