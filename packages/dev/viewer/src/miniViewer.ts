import "@babylonjs/loaders/glTF/2.0";
import { AbstractEngine, Color4, Engine, HemisphericLight, Nullable } from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import type { FramingBehavior } from "@babylonjs/core/Behaviors/Cameras/framingBehavior";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";

export interface ViewerOptions {
    engine?: AbstractEngine|null;
    canvas?: HTMLCanvasElement|OffscreenCanvas|null;
    antialias?: boolean;
    skyboxPath?: string;
}

export class MiniViewer
{
    private _scene: Scene;
    private _disposableEngine: Nullable<AbstractEngine> = null;

    static async createAsync(options?: ViewerOptions): Promise<MiniViewer> {
        return new Promise((resolve, reject) => {
            if (!options?.canvas && !options?.engine) {
                throw new Error("Babylon.js Viewer needs a Canvas, Offscreen canvas or an Engine.");
            }
            try {
                const engine = options.engine ?? new Engine(options.canvas!, !!options.antialias);
                resolve(new MiniViewer({engine: engine, canvas: options.canvas, antialias: options.antialias, skyboxPath: options.skyboxPath}));
            } catch (error) {
                reject(error);
            }
        });
    }
    
    constructor(options?: ViewerOptions ) {
        if (!options?.engine) {
            throw new Error("No engine set in Viewer constructor options.");
        }
        this._disposableEngine = options.canvas ? options.engine : null;
        this._scene = new Scene(options?.engine!);
        this._scene.clearColor = new Color4(0.1,0.1,0.2,1.0);
        const camera = new ArcRotateCamera("camera1", 0,0,1, Vector3.Zero(), this._scene);
        this._prepareCamera(); // set default camera values
        this._prepareEnvironment(options.skyboxPath);
        // render at least back ground. Maybe we can only run renderloop when a mesh is loaded. What to render until then?
        this._scene.getEngine().runRenderLoop(() => {
            this._scene.render();
        });
    }

    public loadModelAsync(url: string): Promise<void> {
        return new Promise((resolve, reject) =>{
            try {
                SceneLoader.ImportMesh("","", url, this._scene, (meshes)=> {
                    this._prepareCamera();
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    public dispose(): void {
        this._scene.dispose();
        if (this._disposableEngine) {
            this._disposableEngine.dispose();
        }
    }

    private _prepareEnvironment(path: string | undefined) {
        if (!path) {
            const light = new HemisphericLight("hemilight", Vector3.Up(), this._scene);
            this._scene.autoClear = true;
            return;
        }
        this._scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(path, this._scene);
        this._createDefaultSkybox((this._scene.activeCamera!.maxZ - this._scene.activeCamera!.minZ) / 2, 0.3, false);
        this._scene.autoClear = false;
    }
    
    //copy/paste from scene helpers
    private _createDefaultSkybox(scale = 1000, blur = 0, setGlobalEnvTexture = true): void {
        const scene = this._scene;
        const hdrSkybox = CreateBox("hdrSkyBox", { size: scale }, scene);
        const hdrSkyboxMaterial = new PBRMaterial("skyBox", scene);
        hdrSkyboxMaterial.backFaceCulling = false;
        hdrSkyboxMaterial.reflectionTexture = scene.environmentTexture!.clone();
        if (hdrSkyboxMaterial.reflectionTexture) {
            hdrSkyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
        }
        hdrSkyboxMaterial.microSurface = 1.0 - blur;
        hdrSkyboxMaterial.disableLighting = true;
        hdrSkyboxMaterial.twoSidedLighting = true;
        hdrSkybox.material = hdrSkyboxMaterial;
        hdrSkybox.isPickable = false;
        hdrSkybox.infiniteDistance = true;
        hdrSkybox.ignoreCameraMaxZ = true;
    }

    // copy/paste from sandbox and scene helpers
    private _prepareCamera(): void {
        const camera = this._scene.activeCamera as ArcRotateCamera;

        // Enable camera's behaviors
        camera.useFramingBehavior = true;
        const framingBehavior = camera.getBehaviorByName("Framing") as FramingBehavior;
        framingBehavior.framingTime = 0;
        framingBehavior.elevationReturnTime = -1;

        let radius = 1;
        if (this._scene.meshes.length) {
            // get bounds and prepare framing/camera radius from its values
            camera.lowerRadiusLimit = null;

            const worldExtends = this._scene.getWorldExtends(function (mesh) {
                return mesh.isVisible && mesh.isEnabled();
            });
            framingBehavior.zoomOnBoundingInfo(worldExtends.min, worldExtends.max);

            const worldSize = worldExtends.max.subtract(worldExtends.min);
            const worldCenter = worldExtends.min.add(worldSize.scale(0.5));

            radius = worldSize.length() * 1.5;

            if (!isFinite(radius)) {
                radius = 1;
                worldCenter.copyFromFloats(0, 0, 0);
            }

            camera.setTarget(worldCenter);
        }
        camera.lowerRadiusLimit = radius * 0.01;
        camera.wheelPrecision = 100 / radius;
        camera.alpha = Math.PI / 2;
        camera.beta = Math.PI / 2;
        camera.radius = radius;
        camera.minZ = radius * 0.01;
        camera.maxZ = radius * 1000;
        camera.speed = radius * 0.2;
        camera.useAutoRotationBehavior = true;
        camera.pinchPrecision = 200 / camera.radius;
        camera.upperRadiusLimit = 5 * camera.radius;
        camera.wheelDeltaPercentage = 0.01;
        camera.pinchDeltaPercentage = 0.01;
    }
}
