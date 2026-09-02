import { useRef, useEffect } from 'react'
import { useImportStore } from '../../stores/importStore'
import { useWikiStore } from '../../stores/wikiStore'
import type { FileEntry } from '../../stores/importStore'

export function ImportPage() {
  const { 
    files, 
    selectedFile, 
    folderPath, 
    targetWiki, 
    targetFolder,
    setFiles, 
    setSelectedFile, 
    setFolderPath, 
    setTargetWiki, 
    setTargetFolder,
    removeFile,
    reset 
  } = useImportStore()
  const { currentWiki, repos, tree } = useWikiStore()
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (currentWiki && !targetWiki) {
      setTargetWiki(currentWiki)
    }
  }, [currentWiki, targetWiki, setTargetWiki])

  const storageFolders = tree?.children
    ?.filter(c => c.kind === 'dir' && c.name !== 'wiki')
    .map(c => c.name) || []

  const handleSelectFolder = () => {
    const input = folderInputRef.current
    if (input) {
      input.removeAttribute('webkitdirectory')
      input.removeAttribute('directory')
      void input.offsetWidth
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
      input.click()
    }
  }

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files
    if (!filesList || filesList.length === 0) return

    const firstFile = filesList[0]
    const fullPath = firstFile?.webkitRelativePath || firstFile?.name || ''
    const folderPathParts = fullPath.split('/')
    folderPathParts.pop()
    const selectedFolder = folderPathParts.join('/') || 'Selected Folder'
    setFolderPath(selectedFolder || 'Selected Folder')

    const docFiles: FileEntry[] = []
    const seen = new Set<string>()
    for (let i = 0; i < filesList.length; i++) {
      const f = filesList[i]!
      const name = f.name.toLowerCase()
      if (name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx') || 
          name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.html')) {
        const relPath = f.webkitRelativePath || f.name
        if (!seen.has(relPath)) {
          seen.add(relPath)
          docFiles.push({ name: f.name, relPath, isDirectory: false, size: f.size })
        }
      }
    }
    setFiles(docFiles)
    e.target.value = ''
  }

  const handleSelectFile = (file: FileEntry) => {
    setSelectedFile(file)
  }

  const handleTransfer = () => {
    if (!selectedFile) return
    alert(`[MinerU] 转换请求已收到:\n  ${selectedFile.name}\n\nMinerU 服务尚未接入，接入后将在此显示实时进度。`)
  }

  const handleAdd = () => {
    if (!selectedFile) return
    alert('Add file directly: ' + selectedFile.name + ' (MinerU integration pending)')
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-[280px] flex flex-col border-r border-[var(--color-border-separator)]">
        <header className="px-4 py-4 border-b border-[var(--color-border-separator)]">
          <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Import Files</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-4 bg-[var(--color-surface-container-low)]/35 border border-[var(--color-border-separator)] rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--color-brand)]">From</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handleSelectFolder}
                className="flex items-center gap-1.25 px-3 py-1.5 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold text-xs transition-all hover:opacity-90"
              >
                <span>📂</span> Select Folder
              </button>
            </div>
            <div className="text-xs font-mono text-[var(--color-text-secondary)] truncate" title={folderPath}>
              {folderPath}
            </div>
          </div>

          <div className="p-4 bg-[var(--color-surface-container-low)]/35 border border-[var(--color-border-separator)] rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--color-tertiary)]">To</span>
            </div>
            
            <div className="mb-3">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Knowledge Base</label>
              <select
                value={targetWiki}
                onChange={(e) => setTargetWiki(e.target.value)}
                className="w-full px-3 py-2 text-xs text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border-separator)] rounded-md outline-none transition-all focus:border-[var(--color-brand)] cursor-pointer"
              >
                {repos.map((repo) => (
                  <option key={repo.name} value={repo.name}>{repo.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Target Folder</label>
              <select
                value={targetFolder}
                onChange={(e) => setTargetFolder(e.target.value)}
                className="w-full px-3 py-2 text-xs text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border-separator)] rounded-md outline-none transition-all focus:border-[var(--color-brand)] cursor-pointer"
              >
                <option value="">Select folder...</option>
                {storageFolders.map((folder) => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={reset}
            className="w-full px-3 py-1.5 rounded-md bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)] hover:border-[var(--color-text-secondary)] transition-all text-xs"
          >
            Reset
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="py-8 px-8">
          {files.length > 0 && (
            <div className="border border-[var(--color-border-separator)] rounded-md overflow-hidden">
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="bg-[var(--color-surface-container-low)]/50 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] sticky top-0 z-10">
                        File
                      </th>
                      <th className="bg-[var(--color-surface-container-low)]/50 w-[60px] text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] sticky top-0 z-10">
                        Select
                      </th>
                      <th className="bg-[var(--color-surface-container-low)]/50 w-[120px] text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] sticky top-0 z-10">
                        Progress
                      </th>
                      <th className="bg-[var(--color-surface-container-low)]/50 w-[50px] text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] sticky top-0 z-10">
                        Remove
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file) => (
                      <tr
                        key={file.relPath}
                        onClick={() => handleSelectFile(file)}
                        className={`cursor-pointer transition-colors ${selectedFile?.relPath === file.relPath ? 'bg-[var(--color-brand)]/6' : 'hover:bg-[var(--color-surface-container-low)]/15'}`}
                      >
                        <td className="px-4 py-2 text-[var(--color-text-secondary)] border-b border-[var(--color-border-separator)] last:border-b-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm opacity-70">{file.name.toLowerCase().endsWith('.pdf') ? '📕' : file.name.toLowerCase().endsWith('.md') ? '📝' : file.name.toLowerCase().endsWith('.html') ? '🌐' : '📄'}</span>
                            {file.name}
                          </div>
                        </td>
                        <td className="text-center border-b border-[var(--color-border-separator)] last:border-b-0">
                          <input
                            type="radio"
                            name="import-radio"
                            checked={selectedFile?.relPath === file.relPath}
                            onChange={() => handleSelectFile(file)}
                            className="appearance-none w-4 h-4 border-2 border-[var(--color-text-tertiary)]/40 rounded-full bg-transparent cursor-pointer transition-all hover:border-[var(--color-brand)] checked:border-[var(--color-brand)] checked:bg-[var(--color-brand)]"
                          />
                        </td>
                        <td className="text-center border-b border-[var(--color-border-separator)] last:border-b-0">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1 bg-[var(--color-surface-container-low)]/40 rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--color-brand)] rounded-full" style={{ width: '0%' }} />
                            </div>
                            <span className="text-xs font-mono text-[var(--color-text-tertiary)]">Ready</span>
                          </div>
                        </td>
                        <td className="text-center border-b border-[var(--color-border-separator)] last:border-b-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFile(file.relPath) }}
                            className="w-7 h-7 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-container)]/15 rounded-md transition-colors"
                            title="Remove file"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {files.length === 0 && folderPath !== 'No folder selected' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm mb-1">No documents found</p>
              <p className="text-[var(--color-text-tertiary)] text-xs">请选择包含文档的文件夹</p>
            </div>
          )}

          {folderPath === 'No folder selected' && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-[var(--color-surface-container)] flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-tertiary)]">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <p className="text-[var(--color-text-secondary)] text-sm mb-1">选择文件夹开始导入</p>
              <p className="text-[var(--color-text-tertiary)] text-xs">支持 PDF、Word、Markdown 等文档</p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border-separator)]">
            <span className="text-xs text-[var(--color-text-secondary)]">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected'}
            </span>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleTransfer}
                disabled={!selectedFile}
                className="flex items-center gap-1 px-4 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>▸</span> Transfer
              </button>
              <button
                onClick={handleAdd}
                disabled={!selectedFile}
                className="px-4 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <input
          ref={folderInputRef}
          type="file"
          style={{ display: 'none' }}
          multiple
          {...({ directory: '', webkitdirectory: '' } as any)}
          onChange={handleFolderChange}
        />
      </main>
    </div>
  )
}
