import { useState, useEffect } from 'react'
import { useWikiStore } from '../../stores/wikiStore'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'

export function Sidebar() {
  const { tree, loadPage, currentWiki, repos, switchWiki } = useWikiStore()
  const { openTab, tabs } = useKnowledgeTabStore()
  const [allCollapsed, setAllCollapsed] = useState(true)

  const handleManageRepo = () => {
    openTab('__repo__', '知识库管理', 'repo')
  }

  const handleLoadPage = (path: string) => {
    const title = path.split('/').pop()?.replace('.md', '') || path
    openTab(`wiki-${path}`, title, 'wiki', path)
    loadPage(path)
  }

  const handleAdd = () => {
    openTab('__import__', 'Import Files', 'import')
  }

  const hasRepoTab = tabs.some((t) => t.type === 'repo')

  if (!tree) {
    return (
      <aside className="w-[280px] flex flex-col glass-panel border-r border-[var(--color-border-separator)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-separator)]">
          <select
            className="min-w-0 flex-1 max-w-[180px] bg-[var(--color-surface-glass)] border border-[var(--color-border-separator)] rounded-sm text-sm font-medium px-2 py-1.5 text-[var(--color-text-primary)] cursor-pointer outline-none transition-all hover:border-[var(--color-brand)] truncate"
            value={currentWiki}
            onChange={(e) => {
              const selected = repos.find(r => r.name === e.target.value)
              if (selected) {
                void switchWiki(selected.name, selected.path)
              }
            }}
            style={{ textOverflow: 'ellipsis', colorScheme: 'light' }}
          >
            {repos.length > 0 ? (
              repos.map((repo) => (
                <option key={repo.name} value={repo.name} style={{ color: '#1B1C1A', background: '#FFFFFF' }}>{repo.name}</option>
              ))
            ) : (
              <option value={currentWiki} style={{ color: '#1B1C1A', background: '#FFFFFF' }}>{currentWiki || 'Wiki'}</option>
            )}
          </select>
          <button
            onClick={handleManageRepo}
            className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-[5px] border cursor-pointer transition-all ${
              hasRepoTab
                ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'bg-[var(--color-surface-container-low)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-brand)]'
            }`}
          >
            知识库管理
          </button>
        </div>
        <header className="flex items-center gap-2 px-4 py-4 border-b border-[var(--color-border-separator)]">
          <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">导航</h1>
        </header>
        <nav className="flex-1 overflow-y-auto p-3">
          <p className="text-[var(--color-text-secondary)] text-xs" style={{ padding: '14px' }}>加载中...</p>
        </nav>
      </aside>
    )
  }

  const handleCollapseAll = () => {
    setAllCollapsed(!allCollapsed)
  }

  return (
    <aside className="w-[280px] flex flex-col glass-panel border-r border-[var(--color-border-separator)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-separator)]">
        <select
          className="min-w-0 flex-1 max-w-[180px] bg-[var(--color-surface-glass)] border border-[var(--color-border-separator)] rounded-sm text-sm font-medium px-2 py-1.5 text-[var(--color-text-primary)] cursor-pointer outline-none transition-all hover:border-[var(--color-brand)] truncate"
          value={currentWiki}
          onChange={(e) => {
            const selected = repos.find(r => r.name === e.target.value)
            if (selected) {
              void switchWiki(selected.name, selected.path)
            }
          }}
          style={{ textOverflow: 'ellipsis', colorScheme: 'light' }}
        >
          {repos.length > 0 ? (
            repos.map((repo) => (
              <option key={repo.name} value={repo.name} style={{ color: '#1B1C1A', background: '#FFFFFF' }}>{repo.name}</option>
            ))
          ) : (
            <option value={currentWiki} style={{ color: '#1B1C1A', background: '#FFFFFF' }}>{currentWiki || 'Wiki'}</option>
          )}
        </select>
        <button
          onClick={handleManageRepo}
          className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-[5px] border cursor-pointer transition-all ${
            hasRepoTab
              ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-[var(--color-brand)]'
              : 'bg-[var(--color-surface-container-low)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-brand)]'
          }`}
        >
            知识库管理
          </button>
        </div>
        <header className="flex items-center gap-2 px-4 py-4 border-b border-[var(--color-border-separator)]">
          <h1 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">导航</h1>
          <button
            onClick={handleCollapseAll}
            className="ml-auto w-6 h-6 flex items-center justify-center text-xs bg-[var(--color-surface-container-low)] border border-[var(--color-border)] rounded-[6px] text-[var(--color-text-primary)] cursor-pointer transition-all hover:border-[var(--color-brand)]"
            title={allCollapsed ? '展开全部' : '折叠全部'}
          >
            {allCollapsed ? '▾' : '▸'}
          </button>
      </header>
      <nav className="flex-1 overflow-y-auto p-3">
        <TreeView tree={tree} onSelect={handleLoadPage} onAdd={handleAdd} isCollapsed={allCollapsed} />
      </nav>
    </aside>
  )
}

interface TreeNodeData {
  name: string
  path: string
  kind: 'file' | 'dir'
  children?: TreeNodeData[]
}

interface TreeViewProps {
  tree: { children?: TreeNodeData[] }
  onSelect: (path: string) => void
  onAdd?: () => void
  isCollapsed?: boolean
}

function TreeView({ tree, onSelect, onAdd, isCollapsed }: TreeViewProps) {
  const wikiNode = tree.children?.find((c) => c.name === 'wiki' && c.kind === 'dir')
  const storageDirs = tree.children?.filter((c) => c.kind === 'dir' && c.name !== 'wiki') || []
  const rootFiles = tree.children?.filter((c) => c.kind === 'file') || []
  const [storageCollapsed, setStorageCollapsed] = useState(true)

  useEffect(() => {
    if (isCollapsed !== undefined) {
      setStorageCollapsed(isCollapsed)
    }
  }, [isCollapsed])

  return (
    <ul className="list-none p-0 m-0">
      {wikiNode && wikiNode.children && (
        <>
          <li>
            <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]/90 py-3 px-2 mt-1">
              Wiki Content
            </span>
          </li>
          {wikiNode.children.map((child) => (
            <TreeNode key={child.path} node={child} onSelect={onSelect} isCollapsed={isCollapsed} />
          ))}
        </>
      )}

      {storageDirs.length > 0 && (
        <>
          <li>
            <span
              className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--color-brand)]/90 py-3 px-2 mt-1 cursor-pointer select-none hover:opacity-80"
              onClick={() => setStorageCollapsed(!storageCollapsed)}
            >
              <span className="flex items-center gap-1">
                <span className="text-[9px] text-[var(--color-text-tertiary)] transition-transform" style={{ transform: storageCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>▸</span>
                Storage
              </span>
              <span className="flex gap-1.5">
                {onAdd && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAdd(); }}
                    className="text-[11px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-container-low)] border border-[var(--color-border)] rounded-[4px] px-2 py-0.5 cursor-pointer transition-all hover:text-[var(--color-text-primary)] hover:border-[var(--color-brand)]"
                  >
                    Add
                  </button>
                )}
              </span>
            </span>
          </li>
          {!storageCollapsed && storageDirs.map((child) => (
            <TreeNode key={child.path} node={child} onSelect={onSelect} isCollapsed={isCollapsed} />
          ))}
        </>
      )}

      {rootFiles.map((child) => (
        <TreeNode key={child.path} node={child} onSelect={onSelect} />
      ))}

      {!wikiNode && storageDirs.length === 0 && rootFiles.length === 0 && (
        <li>
          <p className="text-[var(--color-text-secondary)] text-xs" style={{ padding: '14px' }}>Empty wiki</p>
        </li>
      )}
    </ul>
  )
}

interface TreeNodeProps {
  node: TreeNodeData
  onSelect: (path: string) => void
  isCollapsed?: boolean
}

function TreeNode({ node, onSelect, isCollapsed: parentCollapsed }: TreeNodeProps) {
  const [isCollapsed, setIsCollapsed] = useState(parentCollapsed ?? true)
  const { currentPath } = useWikiStore()

  useEffect(() => {
    if (parentCollapsed !== undefined) {
      setIsCollapsed(parentCollapsed)
    }
  }, [parentCollapsed])

  if (node.kind === 'dir') {
    return (
      <li className="mt-1">
        <div
          className={`flex items-center gap-1 px-2 py-1.5 rounded-[6px] cursor-pointer transition-colors ${isCollapsed ? '' : 'hover:bg-[var(--color-surface-container-low)]'}`}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-[9px] text-[var(--color-text-tertiary)] w-3 text-center transition-transform" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)' }}>▸</span>
          <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{node.name}</span>
        </div>
        {!isCollapsed && node.children && (
          <ul className="list-none p-0 m-0 pl-3">
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} onSelect={onSelect} isCollapsed={isCollapsed} />
            ))}
          </ul>
        )}
      </li>
    )
  }

  const icon = getFileIcon(node.name)
  const isActive = currentPath === node.path

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', `${node.name}\n${node.path}`)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragEnd = () => {}

  return (
    <li className="my-0.5">
      <button
        onClick={() => onSelect(node.path)}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-[12.5px] text-[var(--color-text-secondary)] transition-all cursor-grab active:cursor-grabbing ${
          isActive ? 'bg-[var(--color-brand)]/12 text-[var(--color-brand)] font-medium' : 'hover:bg-[var(--color-surface-container-low)] hover:text-[var(--color-text-primary)]'
        }`}
        title={node.path}
      >
        <span className="text-xs opacity-70">{icon}</span>
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  )
}

function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'md': return '📝'
    case 'html': return '🌐'
    case 'pdf': return '📕'
    case 'json': return '⚙️'
    case 'yaml':
    case 'yml': return '⚙️'
    case 'txt': return '📄'
    case 'png': return '🖼️'
    case 'jpg':
    case 'jpeg': return '🖼️'
    case 'gif': return '🖼️'
    case 'webp': return '🖼️'
    case 'svg': return '📐'
    case 'bmp': return '🖼️'
    case 'pptx': return '📊'
    case 'ppt': return '📊'
    case 'doc':
    case 'docx': return '📄'
    case 'xls':
    case 'xlsx': return '📊'
    case 'csv': return '📊'
    case 'zip': return '📦'
    case 'rar': return '📦'
    case '7z': return '📦'
    case 'js': return '📜'
    case 'ts': return '📜'
    case 'css': return '🎨'
    case 'py': return '🐍'
    case 'go': return '🐹'
    case 'rs': return '🦀'
    default: return '📄'
  }
}
