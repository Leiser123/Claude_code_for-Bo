import { useState, useEffect } from 'react'
import { useWikiStore } from '../../stores/wikiStore'
import { wikiApi, type BrowseEntry } from '../../api/wikiClient'

interface RepoItem {
  name: string
  path: string
  status: 'active' | 'inactive'
}

export function RepoManagement() {
  const { wikis, currentWiki, multiWikiMode, switchWiki, addRepo, repos } = useWikiStore()
  const [repoList, setRepoList] = useState<RepoItem[]>(() => {
    if (multiWikiMode && wikis.length > 0) {
      return wikis.map((w): RepoItem => ({
        name: w.name,
        path: w.path,
        status: w.name === currentWiki ? 'active' : 'inactive',
      }))
    }
    return [{ name: currentWiki || 'Wiki', path: '', status: 'active' }]
  })
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ name: string; x: number; y: number } | null>(null)
  const [renameDialog, setRenameDialog] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [browserPath, setBrowserPath] = useState('')
  const [browserFiles, setBrowserFiles] = useState<BrowseEntry[]>([])
  const [browserLoading, setBrowserLoading] = useState(false)
  const [availableDrives, setAvailableDrives] = useState<BrowseEntry[]>([])
  const [createName, setCreateName] = useState('')
  const [createParentPath, setCreateParentPath] = useState('')

  useEffect(() => {
    setRepoList(repos.map((r): RepoItem => ({ ...r })))
  }, [repos])

  const loadBrowser = async (dirPath?: string) => {
    setBrowserLoading(true)
    try {
      const result = await wikiApi.browseDir(dirPath)
      setBrowserPath(result.currentPath)
      setBrowserFiles(result.files)
      if (result.currentPath === 'root') {
        setAvailableDrives(result.files)
      }
    } catch (error) {
      console.error('Failed to browse:', error)
    } finally {
      setBrowserLoading(false)
    }
  }

  const handleOpenLocalRepo = async () => {
    setShowFolderDialog(true)
    await loadBrowser()
  }

  const handleCreateRepo = async () => {
    setShowCreateDialog(true)
    setCreateName('')
    setCreateParentPath('')
    await loadBrowser()
  }

  const handleCreateConfirm = async () => {
    if (!createName.trim() || !createParentPath.trim()) {
      alert('请输入仓库名称并选择父文件夹')
      return
    }

    const result = await wikiApi.createWiki(createParentPath, createName)
    if (result.success) {
      setRepoList(repoList.map((r): RepoItem => ({ ...r, status: 'inactive' })).concat([{ name: result.name, path: result.path, status: 'active' }]))
      await switchWiki(result.name, result.path)
      setShowCreateDialog(false)
      setCreateName('')
      setCreateParentPath('')
    } else {
      if (result.error?.includes('EPERM') || result.error?.includes('operation not permitted')) {
        alert('创建失败：权限不足。请选择一个有权限写入的目录，或使用管理员权限运行程序。')
      } else {
        alert(result.error || '创建失败')
      }
    }
  }

  const handleNavigate = (entry: BrowseEntry) => {
    if (entry.isDirectory) {
      loadBrowser(entry.fullPath)
    }
  }

  const handleGoUp = () => {
    if (browserPath && browserPath !== 'root') {
      const parent = browserPath.split('\\').slice(0, -1).join('\\')
      loadBrowser(parent || 'root')
    }
  }

  const handleSelectFolder = async () => {
    if (!browserPath.trim()) return

    const name = browserPath.split('\\').pop() || browserPath.split('/').pop() || browserPath
    const success = await addRepo(name, browserPath.trim())
    
    if (success) {
      setRepoList(repoList.map((r): RepoItem => ({ ...r, status: 'inactive' })).concat([{ name, path: browserPath.trim(), status: 'active' }]))
    }
    
    setShowFolderDialog(false)
    setBrowserPath('')
    setBrowserFiles([])
  }

  const handleSelectRepo = async (name: string) => {
    setRepoList(repoList.map((r): RepoItem => ({ ...r, status: r.name === name ? 'active' : 'inactive' })))
    await switchWiki(name)
  }

  const handleContextMenu = (e: React.MouseEvent, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    let x = e.clientX
    let y = e.clientY
    const maxX = window.innerWidth - 180
    const maxY = window.innerHeight - 120
    x = Math.min(x, maxX)
    y = Math.min(y, maxY)
    setContextMenu({ name, x, y })
  }

  const handleCloseContextMenu = () => {
    setContextMenu(null)
  }

  const handleRename = (name: string) => {
    setContextMenu(null)
    setRenameDialog(name)
    setRenameValue(name)
  }

  const handleRenameConfirm = async () => {
    if (!renameDialog || !renameValue.trim()) {
      alert('请输入新名称')
      return
    }
    if (renameValue.trim() === renameDialog) {
      setRenameDialog(null)
      setRenameValue('')
      return
    }
    // 走 store 的 renameRepo，避免用本地 repoList 覆盖整份仓库清单
    await useWikiStore.getState().renameRepo(renameDialog, renameValue.trim())
    setRepoList(useWikiStore.getState().repos.map((r): RepoItem => ({ ...r })))
    setRenameDialog(null)
    setRenameValue('')
  }

  const handleRemove = async (name: string) => {
    if (!confirm(`确定要从知识库清单中移除 "${name}" 吗？`)) return
    setContextMenu(null)
    await useWikiStore.getState().removeRepo(name)
    setRepoList(useWikiStore.getState().repos.map((r): RepoItem => ({ ...r })))
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-[320px] flex flex-col border-r border-[var(--color-border-separator)]">
        <header className="px-4 py-4 border-b border-[var(--color-border-separator)]">
          <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">知识库清单</h1>
        </header>
        <nav className="flex-1 overflow-y-auto p-3">
          <div className="space-y-2">
            {repoList.map((repo) => (
              <div
                key={repo.name}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-md transition-all ${
                  repo.status === 'active'
                    ? 'bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30'
                    : 'hover:bg-[var(--color-surface-container-low)]/50 border border-transparent'
                }`}
                onContextMenu={(e) => handleContextMenu(e, repo.name)}
              >
                <button
                  onClick={() => handleSelectRepo(repo.name)}
                  className="flex-1 flex flex-col items-start gap-0.5 text-left min-w-0 overflow-hidden"
                >
                  <span className={`text-sm font-medium ${repo.status === 'active' ? 'text-[var(--color-brand)]' : 'text-[var(--color-text-primary)]'}`}>
                    {repo.name}
                  </span>
                  {repo.path && (
                    <span
                      className="text-[11px] text-[var(--color-text-tertiary)] truncate w-full"
                      title={repo.path}
                    >
                      {repo.path}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[76ch] py-12 px-16 animate-fade-up space-y-6">
          <div className="p-6 bg-[var(--color-surface-container-low)]/35 border border-[var(--color-border-separator)] rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">新建仓库</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">在指定文件夹下创建一个新的仓库</p>
              </div>
              <button
                onClick={handleCreateRepo}
                className="ml-4 px-5 py-2.5 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                创建
              </button>
            </div>
          </div>

          <div className="p-6 bg-[var(--color-surface-container-low)]/35 border border-[var(--color-border-separator)] rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">打开本地仓库</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">将一个本地文件夹作为仓库在项目中打开</p>
              </div>
              <button
                onClick={handleOpenLocalRepo}
                className="ml-4 px-5 py-2.5 rounded-md bg-[var(--color-surface-container)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold hover:bg-[var(--color-surface-container-high)] hover:border-[var(--color-brand)] transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                打开
              </button>
            </div>
          </div>
        </div>
      </main>

      {showFolderDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-separator)] rounded-xl p-6 w-[600px] shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">选择 Wiki 知识库</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">请选择包含 wiki 文件夹的知识库目录</p>
              </div>
              <button
                onClick={() => { setShowFolderDialog(false); setBrowserPath(''); setBrowserFiles([]) }}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={handleGoUp}
                disabled={browserPath === 'root' || !browserPath}
                className="px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-container)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-container-high)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↑ 返回上级
              </button>
              <select
                value={browserPath === 'root' ? 'root' : browserPath}
                onChange={(e) => {
                  if (e.target.value === 'root') {
                    loadBrowser()
                  } else {
                    loadBrowser(e.target.value)
                  }
                }}
                className="flex-1 px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border-separator)] rounded-md outline-none transition-all focus:border-[var(--color-brand)] cursor-pointer"
              >
                <option value="root">此电脑</option>
                {availableDrives.map((drive) => (
                  <option key={drive.fullPath} value={drive.fullPath}>{drive.name}</option>
                ))}
                {browserPath !== 'root' && browserPath && (
                  <option key={browserPath} value={browserPath}>{browserPath}</option>
                )}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border border-[var(--color-border-separator)] rounded-md">
              {browserLoading ? (
                <div className="flex items-center justify-center h-32 text-[var(--color-text-secondary)] text-sm">加载中...</div>
              ) : browserFiles.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-[var(--color-text-secondary)] text-sm">文件夹为空</div>
              ) : (
                <div className="p-2">
                  {browserFiles.map((entry) => (
                    <div
                      key={entry.fullPath}
                      onClick={() => handleNavigate(entry)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        entry.isDirectory ? 'hover:bg-[var(--color-surface-container-low)]' : 'opacity-60'
                      }`}
                    >
                      <span className="text-lg">
                        {entry.isDirectory ? '📁' : '📄'}
                      </span>
                      <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                        {entry.name}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {entry.isDirectory ? '文件夹' : formatSize(entry.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-border-separator)] pt-3 mt-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">或手动输入路径</label>
              <input
                type="text"
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                placeholder="C:\Users\...\knowledge-repo"
                className="w-full px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)] rounded-md outline-none transition-all focus:border-[var(--color-brand)]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowFolderDialog(false); setBrowserPath(''); setBrowserFiles([]) }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSelectFolder}
                className="px-5 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold hover:opacity-90 transition-all"
              >
                确认选择
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-separator)] rounded-xl p-6 w-[600px] shadow-2xl flex flex-col max-h-[70vh]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">新建 Wiki 仓库</h3>
                <p className="text-xs text-[var(--color-text-secondary)]">选择父文件夹并输入仓库名称</p>
              </div>
              <button
                onClick={() => { setShowCreateDialog(false); setCreateName(''); setCreateParentPath(''); setBrowserPath(''); setBrowserFiles([]) }}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">仓库名称</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="输入仓库名称..."
                className="w-full px-4 py-3 text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)] rounded-md outline-none transition-all focus:border-[var(--color-brand)]"
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  if (browserPath && browserPath !== 'root') {
                    const parent = browserPath.split('\\').slice(0, -1).join('\\')
                    loadBrowser(parent || 'root')
                  }
                }}
                disabled={browserPath === 'root' || !browserPath}
                className="px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-surface-container)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface-container-high)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↑ 返回上级
              </button>
              <select
                value={browserPath === 'root' ? 'root' : browserPath}
                onChange={(e) => {
                  if (e.target.value === 'root') {
                    loadBrowser()
                  } else {
                    loadBrowser(e.target.value)
                  }
                }}
                className="flex-1 px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border-separator)] rounded-md outline-none transition-all focus:border-[var(--color-brand)] cursor-pointer"
              >
                <option value="root">此电脑</option>
                {availableDrives.map((drive) => (
                  <option key={drive.fullPath} value={drive.fullPath}>{drive.name}</option>
                ))}
                {browserPath !== 'root' && browserPath && (
                  <option key={browserPath} value={browserPath}>{browserPath}</option>
                )}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border border-[var(--color-border-separator)] rounded-md mb-4">
              {browserLoading ? (
                <div className="flex items-center justify-center h-32 text-[var(--color-text-secondary)] text-sm">加载中...</div>
              ) : browserFiles.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-[var(--color-text-secondary)] text-sm">文件夹为空</div>
              ) : (
                <div className="p-2">
                  {browserFiles.map((entry) => (
                    <div
                      key={entry.fullPath}
                      onClick={() => {
                        if (entry.isDirectory) {
                          loadBrowser(entry.fullPath)
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                        entry.isDirectory ? 'hover:bg-[var(--color-surface-container-low)]' : 'opacity-60'
                      }`}
                    >
                      <span className="text-lg">
                        {entry.isDirectory ? '📁' : '📄'}
                      </span>
                      <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">
                        {entry.name}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {entry.isDirectory ? '文件夹' : formatSize(entry.size)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-border-separator)] pt-3 mb-3">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">或手动输入父文件夹路径</label>
              <input
                type="text"
                value={createParentPath}
                onChange={(e) => setCreateParentPath(e.target.value)}
                placeholder="C:\Users\...\parent-folder"
                className="w-full px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)] rounded-md outline-none transition-all focus:border-[var(--color-brand)]"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-[var(--color-text-tertiary)] min-w-0 truncate">
                将在 <span className="text-[var(--color-text-secondary)]">{(createParentPath || browserPath) === 'root' ? '此电脑' : (createParentPath || browserPath)}</span> 下创建
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => { setShowCreateDialog(false); setCreateName(''); setCreateParentPath(''); setBrowserPath(''); setBrowserFiles([]) }}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const targetPath = createParentPath || browserPath
                    if (targetPath && targetPath !== 'root') {
                      setCreateParentPath(targetPath)
                      handleCreateConfirm()
                    } else {
                      alert('请选择或输入一个父文件夹路径')
                    }
                  }}
                  disabled={!createName.trim()}
                  className="px-5 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  确认创建
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleCloseContextMenu} />
          <div
            className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border-separator)] rounded-lg shadow-xl py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                handleCloseContextMenu()
              }}
              className="w-full px-4 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container-low)] transition-colors"
            >
              关闭
            </button>
            <button
              onClick={() => handleRename(contextMenu.name)}
              className="w-full px-4 py-2 text-sm text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container-low)] transition-colors"
            >
              重命名
            </button>
            <button
              onClick={() => handleRemove(contextMenu.name)}
              className="w-full px-4 py-2 text-sm text-left text-[var(--color-error)] hover:bg-[var(--color-error-container)]/15 transition-colors"
            >
              从仓库中移除
            </button>
          </div>
        </>
      )}

      {renameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border-separator)] rounded-xl p-6 w-[400px] shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">重命名仓库</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm()
                if (e.key === 'Escape') { setRenameDialog(null); setRenameValue('') }
              }}
              className="w-full px-4 py-3 text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)] rounded-md outline-none transition-all focus:border-[var(--color-brand)] mb-4"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setRenameDialog(null); setRenameValue('') }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRenameConfirm}
                className="px-5 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold hover:opacity-90 transition-all"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
