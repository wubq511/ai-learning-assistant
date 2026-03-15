import { describe, expect, it } from 'vitest'
import { buildWorkspace } from './workspaceBuilder'

describe('buildWorkspace', () => {
  it('splits topic input into multiple meaningful nodes instead of static demo nodes', () => {
    const workspace = buildWorkspace({
      sourceType: 'topic',
      title: '牛顿第二定律',
      sourceText:
        '定义：牛顿第二定律描述合外力、质量与加速度的关系。\n应用：解题时先选研究对象，再做受力分析。\n注意：只有在惯性参考系中才能直接使用 F=ma。',
    })

    expect(workspace.nodes.length).toBeGreaterThanOrEqual(3)
    expect(workspace.nodes.map((node) => node.title)).toContain('牛顿第二定律')
    expect(workspace.nodes.some((node) => node.summary.includes('受力分析'))).toBe(true)
    expect(workspace.conversations[workspace.nodes[0].id]?.messages[0]?.content).toBe(workspace.nodes[0].summary)
    expect(workspace.studyNotes).toEqual([])
  })

  it('turns notes input into multiple note-based chunks with excerpts', () => {
    const workspace = buildWorkspace({
      sourceType: 'notes',
      title: '电场笔记',
      sourceText: '定义：电场强度是单位正电荷所受的力。\n公式：E=F/q。\n例题：先判断场源，再代入公式。',
    })

    expect(workspace.nodes.length).toBeGreaterThanOrEqual(3)
    expect(workspace.nodes[1]?.title).toBe('E=F/q')
    expect(workspace.nodes[2]?.title).toBe('先判断场源')
    expect(workspace.nodes.every((node) => node.reference?.excerpt?.length)).toBe(true)
    expect(workspace.edges.length).toBeGreaterThan(0)
  })

  it('builds pdf nodes from real sections while preserving page linkage', () => {
    const workspace = buildWorkspace({
      sourceType: 'pdf',
      title: 'lecture.pdf',
      sourceText: '绪论\n\n主定理',
      pdfDocument: {
        name: 'lecture.pdf',
        path: 'C:/lecture.pdf',
        data: new Uint8Array([1, 2]),
        pageCount: 8,
        sections: [
          { id: 'section-1', title: '绪论', page: 1, excerpt: '绪论部分介绍研究背景和问题来源。' },
          { id: 'section-2', title: '主定理', page: 4, excerpt: '主定理部分给出关键结论与证明线索。' },
        ],
      },
    })

    expect(workspace.nodes[0]?.reference?.page).toBe(1)
    expect(workspace.nodes[1]?.reference?.page).toBe(4)
    expect(workspace.nodes[1]?.summary).toContain('关键结论')
    expect(workspace.pdfDocument?.sections.length).toBe(2)
  })
})
