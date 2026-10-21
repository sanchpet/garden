export declare global {
  interface SpaNavigateOptions {
    /** Replace the current history entry instead of pushing a new one. */
    replace?: boolean
    /** Keep the scroll position instead of jumping to the top. */
    keepScroll?: boolean
  }
  interface Document {
    addEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    removeEventListener<K extends keyof CustomEventMap>(
      type: K,
      listener: (this: Document, ev: CustomEventMap[K]) => void,
    ): void
    dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K] | UIEvent): void
  }
  interface Window {
    spaNavigate(url: URL, isBack?: boolean, opts?: SpaNavigateOptions): Promise<void>
    spaPrefetch(url: URL): void
    addCleanup(fn: (...args: any[]) => void)
  }
}
