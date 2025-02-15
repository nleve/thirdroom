import { IMainThreadContext } from "../MainThread";
import { defineModule, getModule, Thread } from "../module/module.common";
import { codeToKeyCode } from "./KeyCodes";
import {
  InitializeInputStateMessage,
  InputComponentId,
  InputMessageType,
  InputSourceId,
  screenSpaceMouseCoordsSchema,
  ScreenSpaceMouseCoordsTripleBuffer,
} from "./input.common";
import { createInputRingBuffer, enqueueInputRingBuffer, InputRingBuffer, RING_BUFFER_MAX } from "./RingBuffer";
import { CameraRigModule } from "../../plugins/camera/CameraRig.main";
import { createObjectTripleBuffer, getWriteObjectBufferView } from "../allocator/ObjectBufferView";
import { ndcX, ndcY } from "../utils/cords";
import { EditorModule } from "../editor/editor.main";

/*********
 * Types *
 ********/

export interface MainInputModule {
  nextStackId: number;
  disableInputStack: number[];
  inputRingBuffer: InputRingBuffer;
  screenSpaceMouseCoords: ScreenSpaceMouseCoordsTripleBuffer;
}

/******************
 * Initialization *
 *****************/

export const InputModule = defineModule<IMainThreadContext, MainInputModule>({
  name: "input",
  create(ctx, { sendMessage }) {
    // TODO: optimize memory
    const inputRingBuffer = createInputRingBuffer(RING_BUFFER_MAX);

    const screenSpaceMouseCoords = createObjectTripleBuffer(
      screenSpaceMouseCoordsSchema,
      ctx.mainToGameTripleBufferFlags
    );

    sendMessage<InitializeInputStateMessage>(Thread.Game, InputMessageType.InitializeInputState, {
      inputRingBuffer,
      screenSpaceMouseCoords,
    });

    sendMessage<InitializeInputStateMessage>(Thread.Render, InputMessageType.InitializeInputState, {
      inputRingBuffer,
      screenSpaceMouseCoords,
    });

    return {
      nextStackId: 0,
      disableInputStack: [],
      inputRingBuffer,
      screenSpaceMouseCoords,
    };
  },
  init(ctx) {
    const editorModule = getModule(ctx, EditorModule);
    const inputModule = getModule(ctx, InputModule);
    const { inputRingBuffer: irb } = inputModule;
    const camRigModule = getModule(ctx, CameraRigModule);
    const { canvas } = ctx;

    const lastKeyMap: { [key: string]: boolean } = {};

    function enqueue(
      inputSourceId: number,
      componentId: number,
      button: number,
      xAxis: number,
      yAxis: number,
      zAxis: number,
      wAxis: number,
      state: number
    ) {
      if (inputModule.disableInputStack.length > 0) {
        return;
      }

      const orbiting = camRigModule.orbiting;
      const pointerLocked = document.pointerLockElement !== null;

      // Allow editor specific inputs without pointerLocked
      if (
        editorModule.editorLoaded &&
        ((inputSourceId === InputSourceId.Mouse && componentId === InputComponentId.MouseButtons) ||
          state === codeToKeyCode("KeyF"))
      ) {
        enqueueInputRingBuffer(irb, inputSourceId, componentId, button, xAxis, yAxis, zAxis, wAxis, state);
      }

      if (!pointerLocked && !orbiting) {
        return;
      }

      if (!enqueueInputRingBuffer(irb, inputSourceId, componentId, button, xAxis, yAxis, zAxis, wAxis, state)) {
        console.warn("input ring buffer full");
      }
    }

    function forceEnqueue(
      inputSourceId: number,
      componentId: number,
      button: number,
      xAxis: number,
      yAxis: number,
      zAxis: number,
      wAxis: number,
      state: number
    ) {
      if (!enqueueInputRingBuffer(irb, inputSourceId, componentId, button, xAxis, yAxis, zAxis, wAxis, state)) {
        console.warn("input ring buffer full");
      }
    }

    function resetAllInputs() {
      for (const code in lastKeyMap) {
        if (!lastKeyMap[code]) continue;
        forceEnqueue(InputSourceId.Keyboard, InputComponentId.KeyboardButton, 0, 0, 0, 0, 0, codeToKeyCode(code));
        lastKeyMap[code] = false;
      }
      forceEnqueue(InputSourceId.Mouse, InputComponentId.MouseMovement, 0, 0, 0, 0, 0, 0);
      forceEnqueue(InputSourceId.Mouse, InputComponentId.MouseButtons, 0, 0, 0, 0, 0, 0);
      forceEnqueue(InputSourceId.Mouse, InputComponentId.MouseScroll, 0, 0, 0, 0, 0, 0);
    }

    function onMouseDown({ buttons }: MouseEvent) {
      enqueue(InputSourceId.Mouse, InputComponentId.MouseButtons, 0, 0, 0, 0, 0, buttons);
    }

    function onMouseUp({ buttons }: MouseEvent) {
      enqueue(InputSourceId.Mouse, InputComponentId.MouseButtons, 0, 0, 0, 0, 0, buttons);
    }

    function onKeyDown({ code }: KeyboardEvent) {
      if (lastKeyMap[code]) return;
      lastKeyMap[code] = true;

      enqueue(InputSourceId.Keyboard, InputComponentId.KeyboardButton, 1, 0, 0, 0, 0, codeToKeyCode(code));
    }

    function onKeyUp({ code }: KeyboardEvent) {
      lastKeyMap[code] = false;
      enqueue(InputSourceId.Keyboard, InputComponentId.KeyboardButton, 0, 0, 0, 0, 0, codeToKeyCode(code));
    }

    function onMouseMove({ movementX, movementY, clientX, clientY }: MouseEvent) {
      const writeView = getWriteObjectBufferView(inputModule.screenSpaceMouseCoords);
      writeView.coords[0] = ndcX(clientX, canvas.clientWidth);
      writeView.coords[1] = ndcY(clientY, canvas.clientHeight);
      enqueue(InputSourceId.Mouse, InputComponentId.MouseMovement, 0, movementX, movementY, clientX, clientY, 0);
    }

    function onWheel({ deltaX, deltaY }: WheelEvent) {
      enqueue(InputSourceId.Mouse, InputComponentId.MouseScroll, 0, deltaX, deltaY, 0, 0, 0);
    }

    function onBlur() {
      resetAllInputs();
    }

    function onMouseLeave() {
      resetAllInputs();
    }

    function onPointerLockChange() {
      if (document.pointerLockElement !== canvas) {
        resetAllInputs();
      }
    }

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("blur", onBlur);

    document.addEventListener("pointerlockchange", onPointerLockChange);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("wheel", onWheel);

      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("blur", onBlur);

      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  },
});
