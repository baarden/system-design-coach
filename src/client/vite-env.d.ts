/// <reference types="vite/client" />

declare module "*.excalidrawlib" {
  interface ExcalidrawLibrary {
    type: string;
    version: number;
    source: string;
    libraryItems: unknown[];
  }
  const library: ExcalidrawLibrary;
  export default library;
}
