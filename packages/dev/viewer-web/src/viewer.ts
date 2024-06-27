import { AbstractEngine, Engine, Nullable } from "@babylonjs/core";
import { Viewer, ViewerOptions as BaseViewerOptions } from "@babylonjs/viewer2";

type ViewerOptions = BaseViewerOptions & ({
    engine: AbstractEngine;
} | {
    canvas: HTMLCanvasElement;
    antialias?: boolean;
});

export function createViewer(options: ViewerOptions): Viewer {
    if ("engine" in options) {
        return new Viewer(options.engine, options);
    } else {
        return new Viewer(new Engine(options.canvas, options.antialias), options);
    }
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
    this.viewer = createViewer({ canvas });
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
            this.viewer.loadModelAsync(newValue);
            break;
        case "env":
            this.viewer.loadEnvironmentAsync(newValue);
            break;
    }
  }
}

export function registerCustomElements() {
  globalThis.customElements.define("babylon-viewer", HTML3DElement);
}
