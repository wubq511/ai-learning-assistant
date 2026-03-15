import { describe, expect, it } from 'vitest'
import { base64ToUint8Array } from './pdfMetadata'

describe('base64ToUint8Array', () => {
  it('converts a base64 string to binary data', () => {
    const result = base64ToUint8Array('AQID')
    expect(Array.from(result)).toEqual([1, 2, 3])
  })
})
