import { describe, expect, it } from 'vitest'
import {
  buildChatMessage,
  buildDisplayChatContent,
  buildReferencesMarkdown,
  buildReferencesMarkdownFromEntries,
  parseReferencesSchema,
} from './wikiChatPrompt'

describe('wikiChatPrompt', () => {
  it('builds a message with system prompt, knowledge content and the question', () => {
    const message = buildChatMessage(
      { systemPrompt: '' },
      '/kb/wiki',
      '什么是知识库？',
      '### index.md\n知识库是...',
    )

    expect(message).toContain('[系统提示]')
    expect(message).toContain('当前知识库路径：/kb/wiki')
    // llm-wiki 查询逻辑：只读工具查询知识库 + 先读目录页 + raw/ 兜底 + 参考文献 schema
    expect(message).toContain('只允许使用只读工具')
    expect(message).toContain('index.md 或 wiki/index.md')
    expect(message).toContain('raw/')
    expect(message).toContain('references')
    // 加速：禁止 Python 读文档，统一用 Glob/Grep/Read 快速工具
    expect(message).toContain('严禁用 Python')
    expect(message).toContain('[知识库内容]')
    expect(message).toContain('### index.md')
    expect(message).toContain('[用户问题]')
    expect(message).toContain('什么是知识库？')
  })

  it('appends the custom system prompt', () => {
    const message = buildChatMessage(
      { systemPrompt: '请用通俗易懂的语言回答' },
      '/kb/wiki',
      '问题',
      '',
    )

    expect(message).toContain('请用通俗易懂的语言回答')
    // 无检索内容时不输出该段
    expect(message).not.toContain('[知识库内容]')
  })

  it('omits the knowledge content section when the context is blank', () => {
    const message = buildChatMessage({ systemPrompt: '' }, '/kb', '问题', '   ')
    expect(message).not.toContain('[知识库内容]')
  })

  it('builds a paper-style reference list with clickable wiki links', () => {
    const refs = buildReferencesMarkdown(['docs/index.md', 'guide/start.md'])

    expect(refs).toContain('**参考依据**')
    expect(refs).toContain('[1]')
    expect(refs).toContain('[2]')
    expect(refs).toContain('<a href="#" data-wiki-path="docs/index.md" title="docs/index.md">docs/index.md</a>')
    expect(refs).toContain('<a href="#" data-wiki-path="guide/start.md" title="guide/start.md">guide/start.md</a>')
  })

  it('returns an empty string when there are no source paths', () => {
    expect(buildReferencesMarkdown([])).toBe('')
  })

  it('escapes quotes inside wiki paths', () => {
    const refs = buildReferencesMarkdown(['a"b.md'])
    expect(refs).toContain('data-wiki-path="a&quot;b.md"')
  })
})

describe('buildDisplayChatContent', () => {
  it('wraps the system prompt in a collapsed <details> block followed by the question', () => {
    const display = buildDisplayChatContent('你是知识库问答助手。\n规则：1', '什么是知识库？')

    expect(display).toContain('<details><summary>系统提示</summary>')
    expect(display).toContain('<pre>')
    expect(display).toContain('什么是知识库？')
    // 系统提示原文出现在折叠块里
    expect(display).toContain('你是知识库问答助手。')
  })

  it('escapes HTML in the system prompt so it cannot break out of the block', () => {
    const display = buildDisplayChatContent('规则 <b>加粗</b> & 转义', '问题')
    expect(display).not.toContain('<b>加粗</b>')
    expect(display).toContain('&lt;b&gt;加粗&lt;/b&gt;')
    expect(display).toContain('&amp;')
  })

  it('returns just the question when the system prompt is blank', () => {
    expect(buildDisplayChatContent('   ', '问题')).toBe('问题')
  })
})

describe('parseReferencesSchema', () => {
  it('parses a fenced json references block and removes it from the body', () => {
    const text = [
      '根据文档说明，该接口需要两步配置[1]。',
      '',
      '```json',
      '{"references":[{"index":1,"path":"docs/index.md","title":"文档主页"}]}',
      '```',
    ].join('\n')

    const parsed = parseReferencesSchema(text)

    expect(parsed.found).toBe(true)
    expect(parsed.entries).toEqual([{ index: 1, path: 'docs/index.md', title: '文档主页' }])
    expect(parsed.body).toContain('根据文档说明')
    expect(parsed.body).not.toContain('"references"')
  })

  it('accepts a fenced block without the json language tag', () => {
    const text = '回答\n```\n{"references":[{"index":2,"path":"a.md"}]}\n```'
    const parsed = parseReferencesSchema(text)
    expect(parsed.found).toBe(true)
    expect(parsed.entries).toEqual([{ index: 2, path: 'a.md' }])
  })

  it('falls back to a bare json object at the end of the text', () => {
    const text = '回答内容 {"references":[{"index":1,"path":"guide.md"}]}'
    const parsed = parseReferencesSchema(text)
    expect(parsed.found).toBe(true)
    expect(parsed.entries[0]?.path).toBe('guide.md')
    expect(parsed.body).toBe('回答内容')
  })

  it('prefers the last fenced block when several exist', () => {
    const text = [
      '正文[1]',
      '```json',
      '{"references":[{"index":1,"path":"old.md"}]}',
      '```',
      '再补一段',
      '```json',
      '{"references":[{"index":1,"path":"new.md"}]}',
      '```',
    ].join('\n')
    const parsed = parseReferencesSchema(text)
    expect(parsed.entries[0]?.path).toBe('new.md')
    expect(parsed.body).not.toContain('new.md')
    expect(parsed.body).toContain('再补一段')
  })

  it('reports found=false when there is no schema block', () => {
    const parsed = parseReferencesSchema('这只是普通回答')
    expect(parsed.found).toBe(false)
    expect(parsed.entries).toEqual([])
    expect(parsed.body).toBe('这只是普通回答')
  })

  it('ignores malformed json blocks', () => {
    const parsed = parseReferencesSchema('```json\nnot json\n```')
    expect(parsed.found).toBe(false)
    expect(parsed.entries).toEqual([])
  })

  it('skips entries without a path or index', () => {
    const text = '```json\n{"references":[{"index":1,"path":"ok.md"},{"index":"x"},{"path":"noidx.md"}]}\n```'
    const parsed = parseReferencesSchema(text)
    expect(parsed.found).toBe(true)
    expect(parsed.entries).toEqual([{ index: 1, path: 'ok.md' }])
  })
})

describe('buildReferencesMarkdownFromEntries', () => {
  it('builds clickable reference links with titles and wiki-path metadata', () => {
    const markdown = buildReferencesMarkdownFromEntries([
      { index: 1, path: 'docs/index.md', title: '文档主页' },
      { index: 2, path: 'guide/start.md' },
    ])

    expect(markdown).toContain('**参考依据**')
    expect(markdown).toContain('[1]')
    expect(markdown).toContain(
      '<a href="#" data-wiki-path="docs/index.md" title="docs/index.md">文档主页</a>',
    )
    expect(markdown).toContain(
      '<a href="#" data-wiki-path="guide/start.md" title="guide/start.md">guide/start.md</a>',
    )
  })

  it('returns an empty string for an empty entry list', () => {
    expect(buildReferencesMarkdownFromEntries([])).toBe('')
  })
})
