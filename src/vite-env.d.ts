/// <reference types="vite/client" />

// SVG imports → resolved as URL strings by Vite
declare module '*.svg' {
  const src: string;
  export default src;
}
