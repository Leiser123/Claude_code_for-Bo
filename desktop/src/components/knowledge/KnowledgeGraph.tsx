import { useEffect, useRef, useState } from 'react'
import * as d3force from 'd3-force'
import * as d3sel from 'd3-selection'
import * as d3zoom from 'd3-zoom'
import * as d3drag from 'd3-drag'
import { useGraphStore } from '../../stores/graphStore'
import { useKnowledgeTabStore } from '../../stores/knowledgeTabStore'

interface GraphNode extends d3force.SimulationNodeDatum {
  id: string
  label: string
  path: string
  group: string
  degree: number
  title: string | null
}

interface GraphEdge extends d3force.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

interface KnowledgeGraphProps {
  className?: string
}

export function KnowledgeGraph({ className = '' }: KnowledgeGraphProps) {
  const { data } = useGraphStore()
  const { openTab } = useKnowledgeTabStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await useGraphStore.getState().loadGraph()
      setIsLoading(false)
    }
    void loadData()
  }, [])

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    return () => {
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  useEffect(() => {
    if (!data || !svgRef.current) return

    const { width, height } = dimensions

    const svgEl = svgRef.current
    const svg = d3sel.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const defs = svg.append('defs')
    defs
      .append('filter')
      .attr('id', 'graph-node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')
      .append('feGaussianBlur')
      .attr('stdDeviation', 2)

    const vignette = defs
      .append('radialGradient')
      .attr('id', 'graph-bg-vignette')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '70%')
    vignette.append('stop').attr('offset', '0%').attr('stop-color', 'rgba(0,0,0,0)')
    vignette.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(0,0,0,0.45)')

    svg
      .append('rect')
      .attr('class', 'graph-bg')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#graph-bg-vignette)')

    const root = svg.append('g').attr('class', 'graph-root')
    const linkLayer = root.append('g').attr('class', 'links')
    const nodeLayer = root.append('g').attr('class', 'nodes')

    const nodes: GraphNode[] = data.nodes.map((n) => ({ ...n }))
    const links: GraphEdge[] = data.edges.map((e) => ({ ...e }))

    for (const n of nodes) {
      const angle = Math.random() * Math.PI * 2
      const r = 40 + Math.random() * 30
      n.x = width / 2 + Math.cos(angle) * r
      n.y = height / 2 + Math.sin(angle) * r
    }

    const adjacency = new Map<string, Set<string>>()
    for (const n of nodes) adjacency.set(n.id, new Set())
    for (const e of data.edges) {
      const s = typeof e.source === 'string' ? e.source : e.source.id
      const t = typeof e.target === 'string' ? e.target : e.target.id
      adjacency.get(s)?.add(t)
      adjacency.get(t)?.add(s)
    }

    const radius = (n: GraphNode) => 10 + Math.sqrt(n.degree) * 3.2

    const sim = d3force
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3force
          .forceLink<GraphNode, GraphEdge>(links)
          .id((d) => d.id)
          .distance(220)
          .strength(0.12),
      )
      .force('charge', d3force.forceManyBody<GraphNode>().strength(-850).distanceMax(1200))
      .force('center', d3force.forceCenter(width / 2, height / 2))
      .force('collision', d3force.forceCollide<GraphNode>().radius((d) => radius(d) + 28).strength(0.85))
      .force('x', d3force.forceX(width / 2).strength(0.01))
      .force('y', d3force.forceY(height / 2).strength(0.01))
      .alphaDecay(0.003)
      .velocityDecay(0.35)
      .alphaTarget(0.02)
      .alphaMin(0.001)

    sim.force('noise', () => {
      for (const n of nodes) {
        if (n.fx != null) continue
        n.vx = (n.vx ?? 0) + (Math.random() - 0.5) * 0.09
        n.vy = (n.vy ?? 0) + (Math.random() - 0.5) * 0.09
      }
    })

    const linkSel = linkLayer
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke-linecap', 'round')

    const nodeEnter = nodeLayer
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes)
      .enter()
      .append('g')

    nodeEnter.each(function(this: SVGGElement, d: GraphNode) {
      const g = d as unknown as GraphNode
      this.setAttribute('class', `node group-${g.group}${g.degree >= 5 ? ' big' : ''}`)
    })

    const nodeSel = nodeEnter

    const nodeInner = nodeSel
      .append('g')
      .attr('class', 'node-inner')
      .style('animation-delay', (_d, i) => `${Math.min(900, i * 18)}ms`)

    const getNodeColor = (d: GraphNode) => {
      switch (d.group) {
        case 'concepts': return '#818CF8'
        case 'entities': return '#FA9D3B'
        case 'summaries': return '#00DAF3'
        default: return '#6B7280'
      }
    }

    nodeInner
      .append('circle')
      .attr('class', 'node-halo')
      .attr('r', (d) => radius(d) * 1.3)
      .attr('filter', 'url(#graph-node-glow)')
      .style('fill', (d) => getNodeColor(d))

    nodeInner
      .append('circle')
      .attr('class', 'node-main')
      .attr('r', (d) => radius(d))
      .style('fill', (d) => getNodeColor(d))
      .style('stroke', 'rgba(229, 226, 225, 0.9)')
      .style('stroke-width', '1.4')

    nodeInner
      .append('text')
      .attr('dy', (d) => -radius(d) - 8)
      .attr('text-anchor', 'middle')
      .text((d) => d.title || d.label)

    const dragBehavior = d3drag
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.15).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0.015)
        d.fx = null
        d.fy = null
      })
    nodeSel.call(dragBehavior)

    const zoomBehavior = d3zoom
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        root.attr('transform', event.transform.toString())
      })
    svg.call(zoomBehavior)

    nodeSel
      .on('mouseenter', function (_event, d) {
        const neighbors = adjacency.get(d.id) ?? new Set()
        nodeSel.classed('dim', (n) => n.id !== d.id && !neighbors.has(n.id))
        nodeSel.classed('highlight', (n) => n.id === d.id || neighbors.has(n.id))
        linkSel.classed('dim', (l) => {
          const s = (l.source as GraphNode).id ?? (l.source as unknown as string)
          const t = (l.target as GraphNode).id ?? (l.target as unknown as string)
          return s !== d.id && t !== d.id
        })
        linkSel.classed('highlight', (l) => {
          const s = (l.source as GraphNode).id ?? (l.source as unknown as string)
          const t = (l.target as GraphNode).id ?? (l.target as unknown as string)
          return s === d.id || t === d.id
        })
      })
      .on('mouseleave', () => {
        nodeSel.classed('dim', false).classed('highlight', false)
        linkSel.classed('dim', false).classed('highlight', false)
      })
      .on('click', (_event, d) => {
        sim.stop()
        const title = d.path.split('/').pop()?.replace('.md', '') || d.path
        openTab(`wiki-${d.path}`, title, 'wiki')
      })

    sim.on('tick', () => {
      linkSel.attr('d', (d) => {
        const s = d.source as GraphNode
        const t = d.target as GraphNode
        if (s.x == null || s.y == null || t.x == null || t.y == null) return ''
        const dx = t.x - s.x
        const dy = t.y - s.y
        const cx = (s.x + t.x) / 2
        const cy = (s.y + t.y) / 2
        return `M${s.x},${s.y}Q${cx + dy * 0.15},${cy - dx * 0.15} ${t.x},${t.y}`
      })

      nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    return () => {
      sim.stop()
      svg.selectAll('*').remove()
    }
  }, [data, openTab, dimensions])

  return (
    <div className={`flex flex-col h-full w-full flex-1 ${className}`}>
      <div ref={containerRef} className="flex-1 relative overflow-hidden w-full">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-tertiary)] z-10">
            <p>Loading</p>
          </div>
        )}
        <svg id="graph-svg" ref={svgRef} className="absolute inset-0 w-full h-full cursor-grab" />

        <div className="absolute bottom-5 left-5 px-3 py-3 bg-[var(--color-surface-glass)] border border-[var(--color-surface-glass-border)] rounded-md text-xs font-medium text-[var(--color-text-secondary)]">
          <div className="flex items-center gap-2 py-0.75">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#818CF8' }} /> concepts
          </div>
          <div className="flex items-center gap-2 py-0.75">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#FA9D3B' }} /> entities
          </div>
          <div className="flex items-center gap-2 py-0.75">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#00DAF3' }} /> summaries
          </div>
          <div className="flex items-center gap-2 py-0.75">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#6B7280' }} /> other
          </div>
        </div>

        <div className="absolute top-5 right-8 text-xs font-mono text-[var(--color-text-tertiary)]">
          drag nodes · <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-container-low)]/70 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[12px]">scroll</kbd> zoom · <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-container-low)]/70 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[12px]">click</kbd> open
        </div>
      </div>
    </div>
  )
}
