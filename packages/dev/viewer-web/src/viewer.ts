import { MiniViewer } from "@babylonjs/viewer2";

export class HTML3DElement extends HTMLElement {
  public static readonly observedAttributes = Object.freeze(["src"] as const);

  constructor() {
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
  }

  async connectedCallback() {
    console.log(this.getAttribute("src"));
    const canvas = this.shadowRoot!.querySelector("#renderCanvas") as HTMLCanvasElement;
    const viewer = await MiniViewer.createAsync({canvas: canvas, antialias: true, skyboxPath: "https://assets.babylonjs.com/environments/ulmerMuenster.env"});
    viewer.loadModelAsync(this.getAttribute("src")!);
  }
}

export function registerCustomElements() {
  globalThis.customElements.define("babylon-viewer", HTML3DElement);
}
