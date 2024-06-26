import "@babylonjs/loaders/glTF/2.0";
import { Engine } from "@babylonjs/core";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { ILoadingScreen } from "@babylonjs/core/Loading/loadingScreen";
import type { FramingBehavior } from "@babylonjs/core/Behaviors/Cameras/framingBehavior";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

class ViewerLoadingScreen implements ILoadingScreen {
    //optional, but needed due to interface definitions
    constructor(public loadingUIText: string) {}
    loadingUIBackgroundColor: string ="";
    public displayLoadingUI() {}
    public hideLoadingUI() {}
}
  
export class MiniViewer
{
    private _scene: Scene;

    // copy/paste from EnvironmentTools.ts
    private static Skyboxes = [
        "https://assets.babylonjs.com/environments/sanGiuseppeBridge.env",
        "https://assets.babylonjs.com/environments/ulmerMuenster.env",
        "https://assets.babylonjs.com/environments/studio.env",
    ];
    private static SkyboxesRotation = [5.54, 1.9, 0];
    private static SkyboxPath = "";

    private static LoadSkyboxPathTexture(scene: Scene) {
        let path = this.SkyboxPath;
        let rotationY = 0;
        if (path.length === 0) {
            const defaultSkyboxIndex = 1;//Math.max(0, LocalStorageHelper.ReadLocalStorageValue("defaultSkyboxId", 0));
            path = this.Skyboxes[defaultSkyboxIndex];
            rotationY = this.SkyboxesRotation[defaultSkyboxIndex];
        }

        if (path.indexOf(".hdr") === path.length - 4) {
            return new HDRCubeTexture(path, scene, 256, false, true, false, true);
        }

        const envTexture = CubeTexture.CreateFromPrefilteredData(path, scene);
        envTexture.rotationY = rotationY;
        return envTexture;
    }

    static async createAsyncFromCanvas(canvas: any): Promise<MiniViewer> {
        return new Promise((resolve, reject) => {
            try {
                const engine = new Engine(canvas);
                var loadingScreen = new ViewerLoadingScreen("");
                engine.loadingScreen = loadingScreen;
                resolve(new MiniViewer(engine));
            } catch (error) {
                reject(error);
            }
        });
    }
    loadModelAsync(url: string): Promise<void> {
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
    constructor(engine: Engine) {
        this._scene = new Scene(engine);
        this._scene.clearColor.set(0,0,0,0); // makes nothing visible until it's ready
        this._scene.autoClear = false;
        const camera = new ArcRotateCamera("camera1", 0,0,1, Vector3.Zero(), this._scene);
        this._prepareCamera(); // set default camera values
        this._prepareEnvironment();
        // render at least back ground. Maybe we can only run renderloop when a mesh is loaded. What to render until then?
        this._scene.getEngine().runRenderLoop(() => {
            this._scene.render();
        });
    }

    private _prepareEnvironment() {
        const hemisphericLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this._scene);
        this._scene.environmentTexture = MiniViewer.LoadSkyboxPathTexture(this._scene);
        this._createDefaultSkybox((this._scene.activeCamera!.maxZ - this._scene.activeCamera!.minZ) / 2, 0.3, false);
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
