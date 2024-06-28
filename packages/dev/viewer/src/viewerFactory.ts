import { Engine, EngineOptions } from "@babylonjs/core";
import { Viewer, ViewerOptions } from "./viewer";

type CanvasViewerOptions = ViewerOptions & ({ engine: "WebGL" } & EngineOptions);

// Binds to a canvas element.
// Can be shared between multiple UI integrations (e.g. Web Components, React, etc.).
export function createViewerForCanvas(canvas: HTMLCanvasElement, options?: CanvasViewerOptions): Viewer {
    const engine = new Engine(canvas, undefined, options);
    const viewer = new Viewer(engine, options);

    // TODO: register for viewer.onDisposeObservable and dispose engine instance
    // TODO: use ResizeObserver to monitor canvas and update width/height and resize engine (maybe something like https://webgpufundamentals.org/webgpu/lessons/webgpu-resizing-the-canvas.html)
    // TODO: Creating an engine instance will be async if we use a dynamic import for either Engine or WebGPU engine,
    //       or even when just creating a WebGPUEngine since we have to call initAsync. To keep the UI integration layer
    //       simple (e.g. not have to deal with asynchronous creation of the Viewer), should we also be able to pass Promise<AbstractEngine> to the Viewer constructor?

    return viewer;
}
