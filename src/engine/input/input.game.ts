import { getCamera } from "../camera/camera.game";
import { ourPlayerQuery } from "../component/Player";
import { GameState } from "../GameTypes";
import { defineModule, getModule, registerMessageHandler, Thread } from "../module/module.common";
import { XRMode } from "../renderer/renderer.common";
import { getXRMode } from "../renderer/renderer.game";
import { RemoteNode, removeObjectFromWorld } from "../resource/RemoteResources";
import { getRemoteResource, tryGetRemoteResource } from "../resource/resource.game";
import { createDisposables } from "../utils/createDisposables";
import { enableActionMap } from "./ActionMappingSystem";
import {
  InitializeInputStateMessage,
  InputMessageType,
  SharedXRInputSource,
  UpdateXRInputSourcesMessage,
} from "./input.common";
import { InputController, createInputController } from "./InputController";
import { InputControllerComponent } from "./InputControllerComponent";
import { ARActionMap, XRAvatarRig } from "./WebXRAvatarRigSystem";

/*********
 * Types *
 ********/

export interface GameInputModule {
  controllers: Map<number, InputController>;
  defaultController: InputController;
  activeController: InputController;
  xrInputSources: Map<number, SharedXRInputSource>;
  xrInputSourcesByHand: Map<XRHandedness, SharedXRInputSource>;
  xrPrimaryHand: XRHandedness;
  prevXRMode: XRMode;
}

/******************
 * Initialization *
 *****************/

export const InputModule = defineModule<GameState, GameInputModule>({
  name: "input",
  async create(ctx, { waitForMessage }) {
    const { inputRingBuffer } = await waitForMessage<InitializeInputStateMessage>(
      Thread.Main,
      InputMessageType.InitializeInputState
    );

    const controller = createInputController({ inputRingBuffer });

    return {
      controllers: InputControllerComponent,
      defaultController: controller,
      activeController: controller,
      xrInputSources: new Map(),
      xrPrimaryHand: "right",
      xrInputSourcesByHand: new Map(),
      prevXRMode: XRMode.None,
    };
  },
  init(ctx) {
    // TODO: we should enable / disable this depending on whether or not you're in XR
    const input = getModule(ctx, InputModule);
    const controller = input.defaultController;
    enableActionMap(controller, ARActionMap);

    return createDisposables([
      registerMessageHandler(ctx, InputMessageType.UpdateXRInputSources, onUpdateXRInputSources),
    ]);
  },
});

function onUpdateXRInputSources(ctx: GameState, { added, removed }: UpdateXRInputSourcesMessage) {
  const { xrInputSources, xrInputSourcesByHand } = getModule(ctx, InputModule);

  for (const id of removed) {
    const inputSource = xrInputSources.get(id);

    if (inputSource) {
      xrInputSourcesByHand.delete(inputSource.handedness);
      xrInputSources.delete(id);

      const ourPlayer = ourPlayerQuery(ctx.world)[0];
      const xrRig = XRAvatarRig.get(ourPlayer);
      if (xrRig) {
        if (inputSource.handedness === "left") {
          if (xrRig.leftControllerEid) removeObjectFromWorld(ctx, tryGetRemoteResource(ctx, xrRig.leftControllerEid));
          if (xrRig.leftNetworkedEid) removeObjectFromWorld(ctx, tryGetRemoteResource(ctx, xrRig.leftNetworkedEid));
          if (xrRig.leftRayNetworkedEid)
            removeObjectFromWorld(ctx, tryGetRemoteResource(ctx, xrRig.leftRayNetworkedEid));

          xrRig.leftControllerEid = 0;
          xrRig.leftNetworkedEid = 0;
          xrRig.leftRayNetworkedEid = 0;
        } else if (inputSource.handedness === "right") {
          if (xrRig.rightControllerEid) removeObjectFromWorld(ctx, tryGetRemoteResource(ctx, xrRig.rightControllerEid));
          if (xrRig.rightNetworkedEid) removeObjectFromWorld(ctx, tryGetRemoteResource(ctx, xrRig.rightNetworkedEid));
          if (xrRig.rightRayNetworkedEid)
            removeObjectFromWorld(ctx, tryGetRemoteResource(ctx, xrRig.rightRayNetworkedEid));

          xrRig.rightControllerEid = 0;
          xrRig.rightNetworkedEid = 0;
          xrRig.rightRayNetworkedEid = 0;
        }
      }
    }
  }

  for (const item of added) {
    xrInputSources.set(item.id, item);
    xrInputSourcesByHand.set(item.handedness, item);
  }
}

/**********
 * System *
 **********/

export function ResetInputSystem(ctx: GameState) {
  const input = getModule(ctx, InputModule);
  for (const controller of input.controllers.values()) {
    const { raw } = controller;
    raw["Mouse/movementX"] = 0;
    raw["Mouse/movementY"] = 0;
    raw["Mouse/Scroll"] = 0;
  }
}

export function getPrimaryInputSourceNode(ctx: GameState) {
  const ourPlayer = ourPlayerQuery(ctx.world)[0];
  const xrRig = getXRMode(ctx) !== XRMode.None ? XRAvatarRig.get(ourPlayer) : undefined;
  const rightRayNode = xrRig && xrRig.rightRayEid && tryGetRemoteResource<RemoteNode>(ctx, xrRig.rightRayEid);

  if (rightRayNode) {
    return rightRayNode;
  } else {
    const playerNode = getRemoteResource<RemoteNode>(ctx, ourPlayer) as RemoteNode;
    return getCamera(ctx, playerNode).parent as RemoteNode;
  }
}
