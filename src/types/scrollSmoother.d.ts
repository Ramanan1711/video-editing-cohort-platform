declare module 'gsap/ScrollSmoother' {
  export interface ScrollSmootherVars {
    wrapper?: string | HTMLElement | null;
    content?: string | HTMLElement | null;
    smooth?: number;
    effects?: boolean;
    smoothTouch?: number | boolean;
    normalizeScroll?: boolean;
    ignoreMobileResize?: boolean;
    onUpdate?: (self: ScrollSmootherInstance) => void;
    onStop?: (self: ScrollSmootherInstance) => void;
  }

  export interface ScrollSmootherInstance {
    scrollTrigger?: unknown;
    progress: number;
    scrollTop(value?: number): number;
    scrollTo(target: number | string | HTMLElement, smooth?: boolean, position?: string): void;
    paused(state?: boolean): boolean;
    kill(): void;
    refresh(): void;
    effects(targets?: string | Element | Element[], vars?: object): unknown;
  }

  export class ScrollSmoother {
    static register(core: unknown): void;
    static create(vars: ScrollSmootherVars): ScrollSmootherInstance;
    static get(): ScrollSmootherInstance | undefined;
    static refresh(): void;
  }

  export default ScrollSmoother;
}
