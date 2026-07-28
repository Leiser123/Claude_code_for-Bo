import { useEffect, useState } from 'react'
import { SlidePanel } from './SlidePanel'

interface Heading {
  id: string
  text: string
  level: number
}

export function OutlinePanel() {
  const [headings, setHeadings] = useState<Heading[]>([])

  useEffect(() => {
    const extractHeadings = () => {
      const article = document.querySelector('article')
      if (!article) {
        setHeadings([])
        return
      }

      const headingElements = article.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const extractedHeadings: Heading[] = []

      headingElements.forEach((heading) => {
        const level = parseInt(heading.tagName.charAt(1))
        const id = heading.getAttribute('id') || `heading-${extractedHeadings.length}`
        const text = heading.textContent || ''

        if (text && level >= 1 && level <= 6) {
          extractedHeadings.push({ id, text, level })
        }
      })

      setHeadings(extractedHeadings)
    }

    extractHeadings()

    const observer = new MutationObserver(extractHeadings)
    const article = document.querySelector('article')
    if (article) {
      observer.observe(article, { childList: true, subtree: true })
    }

    return () => observer.disconnect()
  }, [])

  const handleHeadingClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      element.focus()
    }
  }

  const getIndentClass = (level: number) => {
    switch (level) {
      case 1: return 'pl-0'
      case 2: return 'pl-3'
      case 3: return 'pl-6'
      case 4: return 'pl-9'
      case 5: return 'pl-12'
      case 6: return 'pl-15'
      default: return 'pl-0'
    }
  }

  const getFontClass = (level: number) => {
    switch (level) {
      case 1: return 'font-bold text-sm'
      case 2: return 'font-semibold text-xs'
      case 3: return 'font-medium text-xs'
      default: return 'text-xs'
    }
  }

  return (
    <SlidePanel title="目录">
      <div className="p-3">
        {headings.length === 0 ? (
          <p className="text-[var(--color-text-tertiary)] text-xs" style={{ padding: '4px 6px' }}>当前页面没有标题</p>
        ) : (
          <nav className="space-y-0.5">
            {headings.map((heading) => (
              <button
                key={heading.id}
                onClick={() => handleHeadingClick(heading.id)}
                className={`block w-full text-left ${getIndentClass(heading.level)} ${getFontClass(heading.level)} px-2 py-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-container)] transition-colors truncate`}
              >
                {heading.text}
              </button>
            ))}
          </nav>
        )}
      </div>
    </SlidePanel>
  )
}
