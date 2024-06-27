import "@babylonjs/loaders/glTF/2.0";
import { AbstractEngine, AssetContainer, BaseTexture, Color4, Engine, HemisphericLight, Nullable } from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { IDisposable, Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { FramingBehavior } from "@babylonjs/core/Behaviors/Cameras/framingBehavior";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { AsyncLock } from "./asyncLock";


//copy/paste from scene helpers
function createDefaultSkybox(scene: Scene, reflectionTexture: BaseTexture, scale: number, blur: number) {
    const hdrSkybox = CreateBox("hdrSkyBox", { size: scale }, scene);
    const hdrSkyboxMaterial = new PBRMaterial("skyBox", scene);
    hdrSkyboxMaterial.backFaceCulling = false;
    hdrSkyboxMaterial.reflectionTexture = reflectionTexture;
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

    return hdrSkybox;
}

export const defaultViewerOptions = {
    backgroundColor: new Color4(0.1, 0.1, 0.2, 1.0),
};

export type ViewerOptions = Readonly<Partial<typeof defaultViewerOptions>>;

export class MiniViewer implements IDisposable
{
    private readonly scene: Scene;
    private readonly camera: ArcRotateCamera;

    private isDisposed = false;

    private readonly loadModelLock = new AsyncLock();
    private assetContainer: Nullable<AssetContainer> = null;
    private loadModelAbortController: Nullable<AbortController> = null;

    private readonly loadEnvironmentLock = new AsyncLock();
    private environment: Nullable<IDisposable> = null;
    private loadEnvironmentAbortController: Nullable<AbortController> = null;

    public constructor(private readonly engine: AbstractEngine, options?: ViewerOptions) {
        const finalOptions = { ...defaultViewerOptions, ...options };
        this.scene = new Scene(this.engine);
        this.scene.clearColor = finalOptions.backgroundColor;
        this.camera = new ArcRotateCamera("camera1", 0,0,1, Vector3.Zero(), this.scene);
        this.camera.attachControl();
        this._reframeCamera(); // set default camera values
        
        // render at least back ground. Maybe we can only run renderloop when a mesh is loaded. What to render until then?
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });
    }

    public async loadModelAsync(url: string, abortSignal?: AbortSignal): Promise<void> {
        if (this.isDisposed) {
            throw new Error("Viewer is disposed");
        }

        this.loadModelAbortController?.abort();
        const abortController = this.loadModelAbortController = new AbortController();

        const throwIfAborted = () => {
            // External cancellation
            abortSignal?.throwIfAborted();

            // Internal cancellation
            abortController.signal.throwIfAborted();
        };

        await this.loadModelLock.lockAsync(async () => {
            throwIfAborted();
            this.assetContainer?.dispose();
            this.assetContainer = await SceneLoader.LoadAssetContainerAsync("", url, this.scene);
            this.assetContainer.addAllToScene();
            this._reframeCamera();
        });
    }

    public async loadEnvironmentAsync(url: Nullable<string | undefined>): Promise<void> {
        if (this.isDisposed) {
            throw new Error("Viewer is disposed");
        }

        this.loadEnvironmentAbortController?.abort();
        const abortController = this.loadEnvironmentAbortController = new AbortController();

        const throwIfAborted = () => {
            // External cancellation
            abortController.signal.throwIfAborted();

            // Internal cancellation
            abortController.signal.throwIfAborted();
        };

        await this.loadEnvironmentLock.lockAsync(async () => {
            throwIfAborted();
            this.environment?.dispose();
            this.environment = await new Promise<IDisposable>((resolve, reject) => {
                if (!url) {
                    const light = new HemisphericLight("hemilight", Vector3.Up(), this.scene);
                    this.scene.autoClear = true;
                    resolve(light);
                }
                else {
                    const cubeTexture = CubeTexture.CreateFromPrefilteredData(url, this.scene);
                    this.scene.environmentTexture = cubeTexture;
                    const skybox = createDefaultSkybox(this.scene, cubeTexture.clone(), (this.camera.maxZ - this.camera.minZ) / 2, 0.3);
                    this.scene.autoClear = false;
    
                    const successObserver = cubeTexture.onLoadObservable.addOnce(() => {
                        successObserver.remove();
                        errorObserver.remove();
                        resolve({
                            dispose() {
                                cubeTexture.dispose();
                                skybox.dispose();
                            }
                        });
                    });
    
                    const errorObserver = Texture.OnTextureLoadErrorObservable.add((texture) => {
                        if (texture === cubeTexture) {
                            successObserver.remove();
                            errorObserver.remove();
                            reject(new Error("Failed to load environment texture"));
                        }
                    });
                }
            });;
        });
    }

    public dispose(): void {
        this.scene.dispose();
        this.isDisposed = true;
    }

    // copy/paste from sandbox and scene helpers
    private _reframeCamera(): void {
        // Enable camera's behaviors
        this.camera.useFramingBehavior = true;
        const framingBehavior = this.camera.getBehaviorByName("Framing") as FramingBehavior;
        framingBehavior.framingTime = 0;
        framingBehavior.elevationReturnTime = -1;

        let radius = 1;
        if (this.scene.meshes.length) {
            // get bounds and prepare framing/camera radius from its values
            this.camera.lowerRadiusLimit = null;

            const worldExtends = this.scene.getWorldExtends(function (mesh) {
                return mesh.isVisible && mesh.isEnabled();
            });
            framingBehavior.zoomOnBoundingInfo(worldExtends.min, worldExtends.max);

            const worldSize = worldExtends.max.subtract(worldExtends.min);
            const worldCenter = worldExtends.min.add(worldSize.scale(0.5));

            radius = worldSize.length() * 1.2;

            if (!isFinite(radius)) {
                radius = 1;
                worldCenter.copyFromFloats(0, 0, 0);
            }

            this.camera.setTarget(worldCenter);
        }
        this.camera.lowerRadiusLimit = radius * 0.01;
        this.camera.wheelPrecision = 100 / radius;
        this.camera.alpha = Math.PI / 2;
        this.camera.beta = Math.PI / 2;
        this.camera.radius = radius;
        this.camera.minZ = radius * 0.01;
        this.camera.maxZ = radius * 1000;
        this.camera.speed = radius * 0.2;
        this.camera.useAutoRotationBehavior = true;
        this.camera.pinchPrecision = 200 / this.camera.radius;
        this.camera.upperRadiusLimit = 5 * this.camera.radius;
        this.camera.wheelDeltaPercentage = 0.01;
        this.camera.pinchDeltaPercentage = 0.01;
    }
}
