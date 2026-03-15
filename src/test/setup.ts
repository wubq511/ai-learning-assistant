import '@testing-library/jest-dom/vitest'

class ResizeObserverMock {
  observe() {}

  unobserve() {}

  disconnect() {}
}

if (!('ResizeObserver' in window)) {
  ;(globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    ResizeObserverMock as typeof ResizeObserver
}

if (!('DOMMatrix' in window)) {
  class DOMMatrixMock {
    a = 1
    d = 1
    e = 0
    f = 0
  }

  ;(globalThis as typeof globalThis & { DOMMatrix: typeof DOMMatrix }).DOMMatrix =
    DOMMatrixMock as typeof DOMMatrix
}
