import { describe, expect, it } from 'vitest'
import { base64ToUint8Array, deriveSectionsFromPageText } from './pdfMetadata'

describe('base64ToUint8Array', () => {
  it('converts a base64 string to binary data', () => {
    const result = base64ToUint8Array('AQID')
    expect(Array.from(result)).toEqual([1, 2, 3])
  })
})

describe('deriveSectionsFromPageText', () => {
  it('derives structured sections from heading-like page text', () => {
    const sections = deriveSectionsFromPageText([
      {
        fullText: '第1章 动量守恒 本章介绍系统动量与碰撞分析。',
        lines: ['第1章 动量守恒', '本章介绍系统动量与碰撞分析。'],
      },
      {
        fullText: '定义 动量是质量与速度的乘积。',
        lines: ['定义 动量', '动量是质量与速度的乘积。'],
      },
      {
        fullText: '这是普通正文，没有明显标题。',
        lines: ['这是普通正文，没有明显标题。'],
      },
    ])

    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({
      title: '第1章 动量守恒',
      page: 1,
      level: 0,
    })
    expect(sections[1]).toMatchObject({
      title: '定义 动量',
      page: 2,
      level: 2,
    })
  })
})
