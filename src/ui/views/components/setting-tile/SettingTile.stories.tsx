import { SettingTile } from "./SettingTile";
import { SettingTileFlex } from "./SettingTileFlex";
import { Label } from "../../../atoms/text/Label";
import { IconButton } from "../../../atoms/button/IconButton";
import { Input } from "../../../atoms/input/Input";
import InfoIC from "../../../../../res/ic/info.svg";

export const title = "SettingTile";

export default function SettingTileStories() {
  return (
    <div style={{ backgroundColor: "white", width: "380px", padding: "8px" }}>
      <SettingTile
        label={<Label htmlFor="defaultDisplayName">Default Display Name</Label>}
        options={
          <IconButton
            variant="surface-low"
            size="sm"
            label="Info"
            iconSrc={InfoIC}
            onClick={(a) => console.log("clicked")}
          />
        }
      >
        <Input id="defaultDisplayName" defaultValue="Kalu" />
      </SettingTile>
      <SettingTileFlex>
        <SettingTile
          label={<Label htmlFor="defaultDisplayName">Default Display Name</Label>}
          options={
            <IconButton
              variant="surface-low"
              size="sm"
              label="Info"
              iconSrc={InfoIC}
              onClick={(a) => console.log("clicked")}
            />
          }
        >
          <Input id="defaultDisplayName" defaultValue="Kalu" />
        </SettingTile>
        <SettingTile
          label={<Label htmlFor="defaultDisplayName">Default Display Name</Label>}
          options={
            <IconButton
              variant="surface-low"
              size="sm"
              label="Info"
              iconSrc={InfoIC}
              onClick={(a) => console.log("clicked")}
            />
          }
        >
          <Input id="defaultDisplayName" defaultValue="Kalu" />
        </SettingTile>
      </SettingTileFlex>
    </div>
  );
}
