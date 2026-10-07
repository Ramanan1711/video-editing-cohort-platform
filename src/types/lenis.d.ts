import type Lenis from 'lenis';

declare global {
  interface Window {
    lenis: Lenis & {
      version?: string;
      horizontal?: boolean;
      snap?: boolean;
      touch?: boolean;
    };
  }
}

