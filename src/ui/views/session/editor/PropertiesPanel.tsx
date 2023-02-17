import { ReactNode, useMemo } from "react";
import classNames from "classnames";

import "./PropertiesPanel.css";

import { Text } from "../../../atoms/text/Text";
import { VectorInput } from "../../components/property-panel/VectorInput";
import { EditorHeader } from "../../components/editor-header/EditorHeader";
import { ColorInput } from "../../components/property-panel/ColorInput";
import { Checkbox } from "../../../atoms/checkbox/Checkbox";
import { getLocalResources, MainNode, MainTexture } from "../../../../engine/resource/resource.main";
import { useMainThreadContext } from "../../../hooks/useMainThread";
import { setProperty, setTextureProperty } from "../../../../engine/editor/editor.main";
import { setEulerFromQuaternion, setQuaternionFromEuler } from "../../../../engine/component/math";
import { Icon } from "../../../atoms/icon/Icon";
import CircleIC from "../../../../../res/ic/circle.svg";
import { PropTypeType, Schema } from "../../../../engine/resource/ResourceDefinition";
import { IMainThreadContext } from "../../../../engine/MainThread";
import { Scroll } from "../../../atoms/scroll/Scroll";
import { SelectInput } from "../../components/property-panel/SelectInput";

function getEulerRotation(quaternion: Float32Array) {
  const rotation = new Float32Array(3);
  if (quaternion) setEulerFromQuaternion(rotation, quaternion);
  return rotation;
}
function getQuaternionRotation(rotation: Float32Array) {
  const quat = new Float32Array(4);
  setQuaternionFromEuler(quat, rotation);
  return quat;
}

function userToEngineChannel(channel: number): number {
  return (1 / 255) * channel;
}
function engineToUserChannel(channel: number): number {
  return Math.round(channel * 255);
}
function userToEngineAlpha(channel: number): number {
  return (1 / 100) * channel;
}
function engineToUserAlpha(channel: number): number {
  return Math.round(channel * 100);
}

function convertRGB(rgb: Float32Array, convertChannel: (channel: number) => number): Float32Array {
  return new Float32Array([convertChannel(rgb[0]), convertChannel(rgb[1]), convertChannel(rgb[2])]);
}
function convertRGBA(
  rgba: Float32Array,
  convertChannel: (channel: number) => number,
  convertAlpha: (channel: number) => number
): Float32Array {
  return new Float32Array([
    convertChannel(rgba[0]),
    convertChannel(rgba[1]),
    convertChannel(rgba[2]),
    convertAlpha(rgba[3]),
  ]);
}

interface PropertyContainerProps {
  className?: string;
  name: string;
  children: ReactNode;
}
export function PropertyContainer({ className, name, children }: PropertyContainerProps) {
  return (
    <div className={classNames("PropertyContainer flex items-center gap-xs", className)}>
      <div className="PropertyContainer__title grow flex items-center">
        <Text className="truncate" variant="b2" weight="medium">
          {name}
        </Text>
      </div>
      <div className="PropertyContainer__children shrink-0 flex items-center flex-wrap">{children}</div>
    </div>
  );
}

export function getPropComponents(ctx: IMainThreadContext, resource: MainNode) {
  function setProp<T>(propName: string, value: T) {
    setProperty(ctx, resource.eid, propName, value);
  }

  const schema = resource.resourceDef.schema;

  type ComponentSchema<T extends PropTypeType, S extends Schema> = {
    [K in keyof T]?: (propName: keyof S, propDef: T[K]) => ReactNode;
  };
  const PropComponents: ComponentSchema<PropTypeType, typeof schema> = {
    bool: (propName, propDef) => {
      const value = resource[propName];
      if (typeof value !== "boolean") return null;
      return (
        <PropertyContainer key={propName} name={propName}>
          <Checkbox
            checked={value ?? propDef.default}
            onCheckedChange={(checked) => setProp(propName, checked)}
            disabled={!propDef.mutable}
          />
        </PropertyContainer>
      );
    },
    vec2: (propName, propDef) => {
      const value = resource[propName];
      if (!ArrayBuffer.isView(value)) return null;
      return (
        <PropertyContainer key={propName} name={propName}>
          <VectorInput
            value={value ?? propDef.default}
            type="vec2"
            onChange={(value) => setProp(propName, value)}
            disabled={!propDef.mutable}
          />
        </PropertyContainer>
      );
    },
    vec3: (propName, propDef) => {
      const value = resource[propName];
      if (!ArrayBuffer.isView(value)) return null;
      return (
        <PropertyContainer key={propName} name={propName}>
          <VectorInput
            value={value ?? propDef.default}
            type="vec3"
            onChange={(value) => setProp(propName, value)}
            disabled={!propDef.mutable}
          />
        </PropertyContainer>
      );
    },
    quat: (propName, propDef) => {
      const value = resource[propName];
      if (!ArrayBuffer.isView(value)) return null;
      return (
        <PropertyContainer key={propName} name={propName === "quaternion" ? "Rotation" : propName}>
          <VectorInput
            value={getEulerRotation(resource.quaternion ?? propDef.default)}
            type="vec3"
            onChange={(value) => {
              setProp(propName, getQuaternionRotation(value));
            }}
            disabled={!propDef.mutable}
          />
        </PropertyContainer>
      );
    },
    rgb: (propName, propDef) => {
      const value = resource[propName];
      if (!ArrayBuffer.isView(value)) return null;
      return (
        <PropertyContainer key={propName} name={propName}>
          <ColorInput
            type="rgb"
            value={convertRGB(value ?? propDef.default, engineToUserChannel)}
            onChange={(value) => setProp(propName, convertRGB(value, userToEngineChannel))}
            disabled={!propDef.mutable}
          />
        </PropertyContainer>
      );
    },
    rgba: (propName, propDef) => {
      const value = resource[propName];
      if (!ArrayBuffer.isView(value)) return null;
      return (
        <PropertyContainer key={propName} name={propName}>
          <ColorInput
            type="rgba"
            value={convertRGBA(value ?? propDef.default, engineToUserChannel, engineToUserAlpha)}
            onChange={(value) => setProp(propName, convertRGBA(value, userToEngineChannel, userToEngineAlpha))}
            disabled={!propDef.mutable}
          />
        </PropertyContainer>
      );
    },
    ref: (propName, propDef) => {
      const value = resource[propName];
      if (typeof value !== "object") return null;
      if (!(value instanceof MainTexture)) return null;

      const options = getLocalResources(ctx, MainTexture).map((res) => ({
        value: res,
        label: res.name,
      }));
      return (
        <PropertyContainer key={propName} name={propName}>
          <SelectInput
            value={value}
            onChange={(changed) => setTextureProperty(ctx, resource.eid, propName, changed.eid)}
            options={options}
          />
        </PropertyContainer>
      );
    },
  };
  return PropComponents;
}

interface PropertiesPanelProps {
  className?: string;
  resource: MainNode;
}

export function PropertiesPanel({ className, resource }: PropertiesPanelProps) {
  const ctx = useMainThreadContext();

  const resourceDef = resource.resourceDef;
  const schema = resourceDef.schema;

  const PropComponents = useMemo(() => getPropComponents(ctx, resource), [ctx, resource]);

  const properties = Object.entries(schema).map(([propName, propDef]) =>
    PropComponents[propDef.type]?.(propName as any, propDef as any)
  );

  return (
    <div className={classNames("PropertiesPanel flex flex-column", className)}>
      <EditorHeader className="shrink-0 flex items-center gap-xxs" style={{ padding: "0 var(--sp-xs)" }}>
        <Icon color="surface" size="sm" src={CircleIC} />
        <Text variant="b2" weight="semi-bold">
          {resource.name ?? "Unnamed"}
        </Text>
      </EditorHeader>
      <div className="grow">
        <Scroll type="scroll">{properties}</Scroll>
      </div>
    </div>
  );
}
