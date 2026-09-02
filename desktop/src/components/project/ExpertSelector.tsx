import { useRef, useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { Bot } from 'lucide-react'

const CARD_GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#a855f7)',
  'linear-gradient(135deg,#ec4899,#f59e0b)',
  'linear-gradient(135deg,#22c55e,#06b6d4)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#06b6d4,#6366f1)',
  'linear-gradient(135deg,#a855f7,#ec4899)',
  'linear-gradient(135deg,#3b82f6,#22c55e)',
  'linear-gradient(135deg,#f97316,#a855f7)',
]

const CARD_WIDTH = 384
const STAGE_RADIUS = 504

type CarouselState = 'spinning' | 'stopped'

export function ExpertSelector() {
  const {
    experts,
    setSelectedExpertId,
    setShowExpertSelector,
  } = useProjectStore()
  // 只展示已激活的专家（设置中可停用）
  const activeExperts = experts.filter((expert) => expert.enabled)
  const stageRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [angle, setAngle] = useState(0)
  const [carouselState, setCarouselState] = useState<CarouselState>('spinning')
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartAngle, setDragStartAngle] = useState(0)
  const rafRef = useRef<number>(0)
  const angularVelocityRef = useRef(0.003)

  // Snap to front card: calculate target angle so that card at `index` faces front
  const snapToCard = useCallback((index: number) => {
    const total = activeExperts.length
    // Card i faces front when angle + (i/total)*2PI = 0 (mod 2PI)
    // So targetAngle = - (index/total)*2PI
    const targetAngle = -((index % total) / total) * Math.PI * 2
    // Normalize to be within a reasonable rotation from current
    let diff = targetAngle - (angle % (Math.PI * 2))
    if (diff > Math.PI) diff -= Math.PI * 2
    if (diff < -Math.PI) diff += Math.PI * 2
    setAngle(angle + diff)
  }, [angle, activeExperts.length])

  // Auto-rotation
  useEffect(() => {
    if (carouselState !== 'spinning') return
    let running = true
    const animate = () => {
      if (!running) return
      setAngle((prev) => prev + angularVelocityRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [carouselState])

  // Position cards in 3D space
  useEffect(() => {
    if (!stageRef.current) return
    const cards = stageRef.current.children
    const total = cards.length
    if (total === 0) return

    for (let i = 0; i < total; i++) {
      const card = cards[i] as HTMLElement
      const a = angle + (i / total) * Math.PI * 2
      const tx = Math.sin(a) * STAGE_RADIUS
      const tz = Math.cos(a) * STAGE_RADIUS
      const depthFactor = (tz + STAGE_RADIUS) / (2 * STAGE_RADIUS)
      const scale = Math.max(0.65, 0.65 + depthFactor * 0.35)
      const zIndex = Math.round(tz * 10)
      const isFront = depthFactor > 0.5
      const highlighted = carouselState === 'stopped' && highlightedIndex === i

      // 有界倾斜（最大 ~60°）：卡片正面始终朝向前方。若像转盘那样直接
      // rotateY(-a)，卡片转到右侧会经过 ±90° 的 edge-on 状态——宽度趋近
      // 0、内容翻转成镜像背面，正是"最右侧闪烁"的来源。
      const tilt = -Math.sin(a) * (Math.PI / 3)
      const zLayer = isFront ? ' translateZ(0.1px)' : ''
      // 缩放并入 transform（避免单独 style.scale 与 3D transform 叠加的合成抖动）
      card.style.transform = `translate3d(${tx}px, 0, ${tz}px) rotateY(${tilt}rad) scale(${highlighted ? 1.1 : scale})${zLayer}`
      card.style.opacity = '1'
      card.style.scale = ''
      card.style.zIndex = String(zIndex)
      card.style.pointerEvents = isFront ? 'auto' : 'none'
    }
  }, [angle, activeExperts.length, carouselState, highlightedIndex])

  // Mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartX(e.clientX)
    setDragStartAngle(angle)
  }, [angle])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartX
      cancelAnimationFrame(rafRef.current)
      setAngle(dragStartAngle + dx * 0.005)
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      // Resume spinning
      setCarouselState('spinning')
      setHighlightedIndex(null)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStartX, dragStartAngle])

  // Click card to stop and highlight it
  const handleCardClick = (index: number) => {
    if (isDragging) return
    if (carouselState === 'spinning') {
      // Stop spinning and snap to this card
      cancelAnimationFrame(rafRef.current)
      setHighlightedIndex(index)
      setCarouselState('stopped')
      snapToCard(index)
    } else {
      // Already stopped: enter chat (second click on highlighted card)
      if (highlightedIndex === index) {
        const expert = activeExperts[index]
        if (expert) {
          setSelectedExpertId(expert.id)
          setShowExpertSelector(false)
        }
      } else {
        // Switch highlight to a different card
        setHighlightedIndex(index)
        snapToCard(index)
      }
    }
  }

  // Close button: resume spinning
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCarouselState('spinning')
    setHighlightedIndex(null)
  }

  if (activeExperts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <Bot className="mb-3 text-[var(--color-text-tertiary)]" size={48} />
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">暂无可用专家</h2>
        <p className="text-xs text-[var(--color-text-tertiary)]">
          请先在 Project 设置中创建专家
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Ask Expert
          </h2>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            {carouselState === 'spinning'
              ? '单击卡片选中 · 拖拽旋转'
              : '再次单击进入咨询 · 点击右上角 ✕ 恢复旋转'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-text-tertiary)]">
            {activeExperts.length} 位专家
          </span>
        </div>
      </div>

      {/* 3D Carousel stage */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
        style={{ perspective: '1200px' }}
      >
        <div
          ref={stageRef}
          className="relative"
          style={{
            width: `${CARD_WIDTH}px`,
            height: '480px',
            transformStyle: 'preserve-3d',
            transform: 'scale(0.64)',
            cursor: isDragging ? 'grabbing' : carouselState === 'spinning' ? 'grab' : 'pointer',
          }}
          onMouseDown={carouselState === 'spinning' ? handleMouseDown : undefined}
        >
          {activeExperts.map((expert, index) => {
            const isHighlighted = highlightedIndex === index
            const cardGradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length]

            return (
              <div
                key={expert.id}
                onClick={() => handleCardClick(index)}
                className={`
                  absolute inset-0 rounded-2xl overflow-hidden flex flex-col select-none
                  ${carouselState === 'stopped' && isHighlighted ? 'ring-2 ring-[var(--color-brand)]' : ''}
                  transition-shadow duration-300
                `}
                style={{
                  width: `${CARD_WIDTH}px`,
                  height: '480px',
                  background: 'var(--color-surface-container-high)',
                  border: isHighlighted && carouselState === 'stopped'
                    ? '2px solid var(--color-brand)'
                    : '1px solid var(--color-border)',
                  boxShadow: isHighlighted && carouselState === 'stopped'
                    ? '0 0 40px rgba(168,85,247,0.3)'
                    : '0 8px 32px rgba(0,0,0,0.2)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Close button — only shown when stopped and highlighted */}
                {carouselState === 'stopped' && isHighlighted && (
                  <button
                    onClick={handleClose}
                    className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full
                      bg-black/30 backdrop-blur-sm text-white/80 hover:text-white
                      flex items-center justify-center text-sm
                      transition-all hover:bg-black/50"
                  >
                    ✕
                  </button>
                )}

                {/* Gradient top banner */}
                <div
                  className="h-28 flex items-end p-5 relative overflow-hidden shrink-0"
                  style={{ background: cardGradient }}
                >
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5" />
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/5" />

                  {/* Avatar */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl relative z-10 shadow-lg"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      border: '2px solid rgba(255,255,255,0.5)',
                    }}
                  >
                    {expert.avatar}
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-2.5 p-4 flex-1">
                  <h3 className="text-base font-black text-[var(--color-text-primary)] tracking-tight">
                    {expert.name}
                  </h3>

                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white"
                      style={{ background: cardGradient }}
                    >
                      {expert.model === 'inherit' ? 'Smart' : expert.customModel || expert.model}
                    </span>
                  </div>

                  <p className="text-xs font-semibold leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">
                    {expert.description || '暂无描述'}
                  </p>

                  {expert.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {expert.skills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[var(--color-text-tertiary)] font-semibold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {isHighlighted && carouselState === 'stopped' && (
                    <div className="text-xs font-medium text-[var(--color-brand)] flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-[14px]">touch_app</span>
                      单击进入咨询
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}