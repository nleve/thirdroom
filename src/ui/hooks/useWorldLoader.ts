import { Room, CallIntent, LocalMedia, Content, GroupCall, Session } from "@thirdroom/hydrogen-view-sdk";
import { useSetAtom } from "jotai";
import { useCallback } from "react";

import { AudioModule, setLocalMediaStream } from "../../engine/audio/audio.main";
import { disposeActiveMatrixRoom, setActiveMatrixRoom } from "../../engine/matrix/matrix.main";
import { getModule, Thread } from "../../engine/module/module.common";
import {
  createMatrixNetworkInterface,
  registerMatrixNetworkInterface,
  provideMatrixNetworkInterface,
} from "../../engine/network/createMatrixNetworkInterface";
import { reconnectPeers } from "../../engine/network/network.main";
import { SetObjectCapMessage, SetObjectCapMessageType } from "../../plugins/spawnables/spawnables.common";
import { enterWorld, exitWorld, loadWorld } from "../../plugins/thirdroom/thirdroom.main";
import { worldAtom } from "../state/world";
import { getRoomCall, updateWorldProfile } from "../utils/matrixUtils";
import { useHydrogen } from "./useHydrogen";
import { useMainThreadContext } from "./useMainThread";

export interface WorldLoader {
  loadWorld: (world: Room, content: Content) => Promise<void>;
  reloadWorld: (world: Room, content: Content) => Promise<void>;
  enterWorld: (
    world: Room,
    options?: {
      reload?: boolean;
    }
  ) => Promise<void>;
  exitWorld: () => void;
}

const getWorldGroupCall = (session: Session, world: Room) => getRoomCall(session.callHandler.calls, world.id);

export function useWorldLoader(): WorldLoader {
  const { session, platform, client } = useHydrogen(true);
  const mainThread = useMainThreadContext();
  const setWorld = useSetAtom(worldAtom);

  const exitWorldCallback = useCallback(async () => {
    provideMatrixNetworkInterface((matrixNetworkInterface) => {
      matrixNetworkInterface?.dispose();
    });

    disposeActiveMatrixRoom(mainThread);

    setWorld({ type: "CLOSE" });
  }, [setWorld, mainThread]);

  const loadWorldCallback = useCallback(
    async (world: Room, content: Content) => {
      const roomId = world.id;

      setWorld({ type: "LOAD", roomId });

      const maxObjectCap = content.max_member_object_cap;
      let sceneUrl = content.scene_url;
      let scriptUrl = content.script_url;

      if (typeof sceneUrl !== "string") {
        throw new Error("3D scene does not exist for this world.");
      }

      if (sceneUrl.startsWith("mxc:")) {
        sceneUrl = session.mediaRepository.mxcUrl(sceneUrl)!;
      }

      if (scriptUrl && scriptUrl.startsWith("mxc:")) {
        scriptUrl = session.mediaRepository.mxcUrl(scriptUrl)!;
      }

      try {
        await loadWorld(mainThread, sceneUrl, scriptUrl);
        await setActiveMatrixRoom(mainThread, session, roomId);

        // set max obj cap
        if (maxObjectCap !== undefined) {
          mainThread.sendMessage<SetObjectCapMessage>(Thread.Game, {
            type: SetObjectCapMessageType,
            value: maxObjectCap,
          });
        }
      } catch (err: any) {
        throw new Error(err?.message ?? "Unknown error loading world.");
      }
    },
    [mainThread, session, setWorld]
  );

  const connectGroupCall = useCallback(
    async (world: Room, groupCall?: GroupCall) => {
      if (!groupCall) {
        groupCall = await session.callHandler.createCall(world.id, "m.voice", "World Call", CallIntent.Room);
      }

      let stream;
      try {
        stream = await platform.mediaDevices.getMediaTracks(true, false);
      } catch (err) {
        console.error(err);
      }
      const localMedia = stream
        ? new LocalMedia().withUserMedia(stream).withDataChannel({})
        : new LocalMedia().withDataChannel({});

      await groupCall.join(localMedia);

      return groupCall;
    },
    [session, platform]
  );

  const enterWorldCallback = useCallback(
    async (world: Room): Promise<void> => {
      try {
        let groupCall = getWorldGroupCall(session, world);
        if (groupCall) {
          await connectGroupCall(world, groupCall);
        } else {
          groupCall = await connectGroupCall(world);
        }

        await updateWorldProfile(session, world);

        setLocalMediaStream(mainThread, groupCall.localMedia?.userMedia);

        const powerLevels = await world.observePowerLevels();
        const matrixNetworkInterface = await createMatrixNetworkInterface(
          mainThread,
          client,
          powerLevels.get(),
          groupCall
        );
        registerMatrixNetworkInterface(matrixNetworkInterface);

        const localPeerId = client.session?.userId;

        if (!localPeerId) {
          throw new Error("Hydrogen session user id is undefined");
        }

        await enterWorld(mainThread, localPeerId);

        const audio = getModule(mainThread, AudioModule);
        audio.context.resume().catch(() => console.error("Couldn't resume audio context"));

        const { muteSettings } = groupCall;
        // Mute after connecting based on user preference
        if (muteSettings?.microphone === false && localStorage.getItem("microphone") !== "true") {
          groupCall.setMuted(muteSettings.toggleMicrophone());
        }

        setWorld({ type: "ENTER" });
      } catch (err) {
        throw err;
      }
    },
    [session, mainThread, connectGroupCall, client, setWorld]
  );

  // keeps the call established and reloads the scene/script
  const reloadWorldCallback = useCallback(
    async (world: Room, content: Content) => {
      setWorld({ type: "LOAD", roomId: world.id });

      disposeActiveMatrixRoom(mainThread);

      exitWorld(mainThread);

      await loadWorldCallback(world, content);

      const localPeerId = client.session?.userId;

      if (!localPeerId) {
        throw new Error("Hydrogen session user id is undefined");
      }

      await enterWorld(mainThread, localPeerId);

      setWorld({ type: "ENTER" });

      reconnectPeers(mainThread);
    },
    [loadWorldCallback, setWorld, mainThread, client]
  );

  return {
    loadWorld: loadWorldCallback,
    enterWorld: enterWorldCallback,
    exitWorld: exitWorldCallback,
    reloadWorld: reloadWorldCallback,
  };
}
