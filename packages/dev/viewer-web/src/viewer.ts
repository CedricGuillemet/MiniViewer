import { Engine, EngineOptions, Logger, Nullable } from "@babylonjs/core";
import { Viewer, ViewerOptions } from "@babylonjs/viewer2";

export function createViewerForCanvas(canvas: HTMLCanvasElement, options?: ViewerOptions & EngineOptions): Viewer {
    const engine = new Engine(canvas, undefined, options);
    const viewer = new Viewer(engine, options);

    // TODO: register for viewer.onDisposeObservable and dispose engine instance
    // TODO: use ResizeObserver to monitor canvas and update width/height and resize engine (maybe something like https://webgpufundamentals.org/webgpu/lessons/webgpu-resizing-the-canvas.html)

    return viewer;
}

export class HTML3DElement extends HTMLElement {
  public static readonly observedAttributes = Object.freeze(["src", "env"] as const);

  private readonly viewer: Viewer;

  public constructor() {
    super();

    const shadowRoot = this.attachShadow({ mode: "open" });
    shadowRoot.innerHTML = `
    <style>
      :host {
        display: block;
        width: 300px;
        height: 150px;
      }

      #container {
        display: block;
        width: 100%;
        height: 100%;
      }

      #renderCanvas {
        width: 100%;
        height: 100%;
        display: block;
        font-size: 0;
      }
    </style>
    <div id="container">
      <canvas id="renderCanvas" touch-action="none"></canvas>
    </div>`;

    const canvas = shadowRoot.querySelector("#renderCanvas") as HTMLCanvasElement;
    this.viewer = createViewerForCanvas(canvas);
  }

  public get src() {
    return this.getAttribute("src");
  }

  public set src(value: Nullable<string>) {
    if (value === null) {
      this.removeAttribute("src");
    } else {
      this.setAttribute("src", value);
    }
  }

  public connectedCallback() {
  }

  public attributeChangedCallback(name: typeof HTML3DElement.observedAttributes[number], oldValue: string, newValue: string) {
    switch(name) {
        case "src":
            this.viewer.loadModelAsync(newValue).catch(Logger.Error);
            break;
        case "env":
            this.viewer.loadEnvironmentAsync(newValue).catch(Logger.Error);
            break;
    }
  }
}

export function registerCustomElements() {
  globalThis.customElements.define("babylon-viewer", HTML3DElement);
}
