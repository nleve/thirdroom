import { IMainThreadContext } from "../../engine/MainThread";
import { defineModule, getModule, registerMessageHandler } from "../../engine/module/module.common";
import { createDisposables } from "../../engine/utils/createDisposables";
import { CameraRigMessage } from "./CameraRig.common";

export const CameraRigModule = defineModule<IMainThreadContext, { orbiting: boolean }>({
  name: "camera-rig-module",
  create() {
    return { orbiting: false };
  },
  init(ctx) {
    const module = getModule(ctx, CameraRigModule);

    return createDisposables([
      registerMessageHandler(ctx, CameraRigMessage.StartOrbit, () => {
        module.orbiting = true;
        document.exitPointerLock();
      }),
      registerMessageHandler(ctx, CameraRigMessage.StopOrbit, () => {
        module.orbiting = false;
        ctx.canvas?.requestPointerLock();
      }),
    ]);
  },
});
