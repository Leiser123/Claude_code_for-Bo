import { useState, useRef, useEffect } from 'react'
import { useWikiStore } from '../../stores/wikiStore'
import { auditApi } from '../../api/wikiClient'

export function FeedbackDialog() {
  const { currentPath, rawMarkdown, author, loadAudits } = useWikiStore()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [comment, setComment] = useState('')
  const [severity, setSeverity] = useState<'info' | 'suggest' | 'warn' | 'error'>('warn')
  const [selStart, setSelStart] = useState(0)
  const [selEnd, setSelEnd] = useState(0)
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = document.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelectedText('')
        return
      }
      const range = sel.getRangeAt(0)
      const pageEl = document.querySelector('article')
      if (!pageEl) {
        setSelectedText('')
        return
      }
      let el: Node | null = range.commonAncestorContainer
      while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode
      if (!el || !pageEl.contains(el)) {
        setSelectedText('')
        return
      }
      const text = sel.toString()
      if (!text.trim()) {
        setSelectedText('')
        return
      }

      const rect = range.getBoundingClientRect()
      const articleRect = pageEl.getBoundingClientRect()
      if (rect.left < articleRect.left || rect.right > articleRect.right) {
        setSelectedText('')
        return
      }

      setButtonPosition({
        x: rect.left,
        y: rect.top - 10,
      })
      setSelectedText(text)
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  const handleOpen = () => {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const text = sel.toString()
    if (!text.trim()) return
    const range = sel.getRangeAt(0)
    const offsets = resolveSelectionToRawOffsets(rawMarkdown, range, text)
    if (!offsets) {
      alert('Could not locate the selection in the source markdown. Try selecting plain text only.')
      return
    }
    setSelStart(offsets.selStart)
    setSelEnd(offsets.selEnd)
    setSelectedText(text.length > 400 ? text.slice(0, 400) + '…' : text)
    setComment('')
    setIsOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 30)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) {
      alert('Comment is empty')
      return
    }
    try {
      await auditApi.createAudit({
        target: currentPath,
        rawMarkdown,
        selStart,
        selEnd,
        comment: comment.trim(),
        severity,
        author,
      })
      setIsOpen(false)
      await loadAudits(currentPath)
    } catch (err) {
      alert(`Error: ${String(err)}`)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!selectedText && !isOpen) {
    return null
  }

  return (
    <>
      {selectedText && !isOpen && (
        <div 
          className="fixed z-50 pointer-events-auto animate-popIn"
          style={{ left: buttonPosition.x, top: buttonPosition.y }}
        >
          <button
            onClick={handleOpen}
            className="px-4 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold shadow-[var(--shadow-dropdown)] hover:shadow-[var(--shadow-button-primary)] transition-all"
          >
            💬 Add feedback
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setIsOpen(false)}>
          <div className="bg-[var(--color-surface-glass)] border border-[var(--color-surface-glass-border)] rounded-xl shadow-[var(--shadow-dropdown)] p-5 backdrop-blur-[30px] max-w-[448px] w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">New audit feedback</h3>

            <div className="mb-4.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Selected text</label>
              <pre className="m-0 bg-[var(--color-inverse-surface)]/50 border-l-3 border-[var(--color-brand)] px-3.5 py-3 font-mono text-xs leading-relaxed max-h-[7em] overflow-y-auto whitespace-pre-wrap break-words text-[var(--color-text-secondary)]">
                {selectedText}
              </pre>
            </div>

            <div className="mb-4.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Severity</label>
              <div className="flex flex-wrap gap-2">
                {(['info', 'suggest', 'warn', 'error'] as const).map((sev) => (
                  <label key={sev} className="cursor-pointer relative">
                    <input
                      type="radio"
                      name="severity"
                      value={sev}
                      checked={severity === sev}
                      onChange={(e) => setSeverity(e.target.value as typeof severity)}
                      className="absolute opacity-0 pointer-events-none"
                    />
                    <span
                      className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.75 rounded-full border transition-all ${
                        severity === sev
                          ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-[var(--color-text-primary)]'
                          : 'bg-[var(--color-surface-container-low)]/35 border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)]/55 hover:border-[var(--color-text-secondary)]'
                      }`}
                    >
                      {sev}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2" htmlFor="feedback-comment">
                Comment (markdown allowed)
              </label>
              <textarea
                ref={textareaRef}
                id="feedback-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Explain what's wrong or what should change…"
                className="w-full min-h-[110px] px-3.5 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] bg-[var(--color-inverse-surface)]/50 border border-[var(--color-border)] rounded-md resize-y outline-none transition-all focus:border-[var(--color-brand)] focus:shadow-[var(--shadow-focus-ring)]"
              />
            </div>

            <div className="flex justify-end gap-2.5 mt-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-2 rounded-md bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-container-low)] hover:border-[var(--color-text-secondary)] transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                className="px-3.5 py-2 rounded-md bg-[var(--color-brand)] text-[var(--color-on-primary)] font-semibold hover:opacity-90 transition-all"
              >
                Save feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function resolveSelectionToRawOffsets(
  raw: string,
  range: Range,
  selText: string,
): { selStart: number; selEnd: number } | null {
  if (!selText) return null

  const scope = findSourceLineAncestor(range.commonAncestorContainer)
  const lines = raw.split('\n')

  if (scope) {
    const [ls, le] = scope
    const startOffset = lineStartOffset(lines, ls - 1)
    const endOffset = le >= lines.length ? raw.length : lineStartOffset(lines, le)
    const slice = raw.slice(startOffset, endOffset)
    const idx = slice.indexOf(selText)
    if (idx >= 0) {
      const next = slice.indexOf(selText, idx + 1)
      if (next < 0) {
        return {
          selStart: startOffset + idx,
          selEnd: startOffset + idx + selText.length,
        }
      }
    }
  }

  const idx = raw.indexOf(selText)
  if (idx < 0) return null
  if (raw.indexOf(selText, idx + 1) >= 0) return null
  return { selStart: idx, selEnd: idx + selText.length }
}

function findSourceLineAncestor(node: Node): [number, number] | null {
  let el: Node | null = node
  while (el && el.nodeType !== Node.ELEMENT_NODE) el = el.parentNode
  while (el && el instanceof HTMLElement) {
    const attr = el.getAttribute('data-source-line')
    if (attr) {
      const parts = attr.split(',').map((x) => parseInt(x.trim(), 10))
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        return [parts[0]!, parts[1]!]
      }
    }
    el = el.parentElement
  }
  return null
}

function lineStartOffset(lines: string[], lineIndex: number): number {
  let offset = 0
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    offset += lines[i]!.length + 1
  }
  return offset
}
