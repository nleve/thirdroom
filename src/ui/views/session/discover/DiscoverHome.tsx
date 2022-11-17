import { Platform, Room, Session, StateEvent } from "@thirdroom/hydrogen-view-sdk";

import { Avatar } from "../../../atoms/avatar/Avatar";
import { Button } from "../../../atoms/button/Button";
import { Content } from "../../../atoms/content/Content";
import { Scroll } from "../../../atoms/scroll/Scroll";
import { Label } from "../../../atoms/text/Label";
import { RoomPreviewCard } from "../../components/room-preview-card/RoomPreviewCard";
import ArrowForwardIC from "../../../../../res/ic/arrow-forward.svg";
import "./DiscoverHome.css";
import { DiscoverGroup, DiscoverGroupGrid, DiscoverMoreButton } from "../../components/discover-group/DiscoverGroup";
import LogoSvg from "../../../../../res/svg/logo.svg";
import {
  FeaturedScene,
  FeaturedSceneContent,
  FeaturedSceneThumbnail,
} from "../../components/featured-scene/FeaturedScene";
import { Text } from "../../../atoms/text/Text";
import { useStateEvents } from "../../../hooks/useStateEvents";
import { RepositoryEvents } from "./DiscoverView";
import { RoomSummaryProvider } from "../../components/RoomSummaryProvider";
import { getAvatarHttpUrl, getIdentifierColorNumber } from "../../../utils/avatar";
import { useHydrogen } from "../../../hooks/useHydrogen";
import { useAsyncCallback } from "../../../hooks/useAsyncCallback";
import { Dots } from "../../../atoms/loading/Dots";

export function useFeaturedRooms(repoRoom: Room) {
  const featuredRoomsMap = useStateEvents(repoRoom, RepositoryEvents.FeaturedRooms);
  return [...featuredRoomsMap].filter(([eventId, stateEvent]) => Object.keys(stateEvent.content).length > 0);
}

export function useFeaturedWorlds(repoRoom: Room) {
  const featuredWorldsMap = useStateEvents(repoRoom, RepositoryEvents.FeaturedWorlds);
  return [...featuredWorldsMap].filter(([eventId, stateEvent]) => Object.keys(stateEvent.content).length > 0);
}

export function FeaturedRoomsProvider({
  room,
  children,
}: {
  room: Room;
  children: (featuredRooms: [string, StateEvent][]) => JSX.Element | null;
}) {
  const featuredRooms = useFeaturedRooms(room);
  return children(featuredRooms);
}

export function FeaturedWorldsProvider({
  room,
  children,
}: {
  room: Room;
  children: (featuredWorlds: [string, StateEvent][]) => JSX.Element | null;
}) {
  const featuredWorlds = useFeaturedWorlds(room);
  return children(featuredWorlds);
}

export function JoinRoomProvider({
  session,
  roomId,
  children,
}: {
  session: Session;
  roomId: string;
  children: (
    join: () => Promise<unknown>,
    isJoined: boolean,
    loading: boolean,
    error: Error | undefined
  ) => JSX.Element | null;
}) {
  const { value, loading, error, callback } = useAsyncCallback(async () => {
    const res = await session.hsApi.joinIdOrAlias(roomId).response();
    const rId = res?.room_id ?? undefined;
    return rId;
  }, [session, roomId]);

  const isJoined = value ? true : !!session.rooms.get(roomId);

  return children(callback, isJoined, loading, error);
}

export function FeaturedRoomCard({
  session,
  platform,
  roomId,
}: {
  session: Session;
  platform: Platform;
  roomId: string;
}) {
  return (
    <RoomSummaryProvider key={roomId} roomIdOrAlias={roomId} fallback={() => <RoomPreviewCard />}>
      {(summaryData) => (
        <RoomPreviewCard
          avatar={
            <Avatar
              imageSrc={
                summaryData.avatarUrl && getAvatarHttpUrl(summaryData.avatarUrl, 60, platform, session.mediaRepository)
              }
              shape="rounded"
              size="lg"
              bgColor={`var(--usercolor${getIdentifierColorNumber(summaryData.roomId)})`}
              name={summaryData.name}
            />
          }
          name={summaryData.name}
          desc={summaryData.topic}
          memberCount={summaryData.memberCount}
          options={
            <JoinRoomProvider session={session} roomId={roomId}>
              {(join, isJoined, loading, error) =>
                isJoined ? (
                  <Button variant="secondary" fill="outline" size="sm" onClick={() => console.log("clicked")}>
                    View
                  </Button>
                ) : (
                  <Button disabled={loading} variant="secondary" size="sm" onClick={join}>
                    {loading && <Dots size="sm" color="on-secondary" />}
                    {loading ? "Joining" : "Join"}
                  </Button>
                )
              }
            </JoinRoomProvider>
          }
        />
      )}
    </RoomSummaryProvider>
  );
}

export function FeaturedWorldCard({
  session,
  platform,
  roomId,
}: {
  session: Session;
  platform: Platform;
  roomId: string;
}) {
  return (
    <RoomSummaryProvider key={roomId} roomIdOrAlias={roomId} fallback={() => <RoomPreviewCard />}>
      {(summaryData) => (
        <RoomPreviewCard
          avatar={
            <Avatar
              imageSrc={
                summaryData.avatarUrl && getAvatarHttpUrl(summaryData.avatarUrl, 60, platform, session.mediaRepository)
              }
              shape="circle"
              size="lg"
              bgColor={`var(--usercolor${getIdentifierColorNumber(summaryData.roomId)})`}
              name={summaryData.name}
            />
          }
          name={summaryData.name}
          desc={summaryData.topic}
          memberCount={summaryData.memberCount}
          options={
            <JoinRoomProvider session={session} roomId={roomId}>
              {(join, isJoined, loading, error) =>
                isJoined ? (
                  <Button variant="secondary" fill="outline" size="sm" onClick={() => console.log("clicked")}>
                    View
                  </Button>
                ) : (
                  <Button disabled={loading} variant="secondary" size="sm" onClick={join}>
                    {loading && <Dots size="sm" color="on-secondary" />}
                    {loading ? "Joining" : "Join"}
                  </Button>
                )
              }
            </JoinRoomProvider>
          }
        />
      )}
    </RoomSummaryProvider>
  );
}

interface DiscoverHomeProps {
  room: Room;
  onLoadEvents: (eventType: RepositoryEvents) => void;
}
export function DiscoverHome({ room, onLoadEvents }: DiscoverHomeProps) {
  const { session, platform } = useHydrogen(true);

  return (
    <Scroll>
      <Content className="DiscoverHome__content">
        <div className="flex flex-column gap-md">
          <FeaturedRoomsProvider room={room}>
            {(featuredRooms) =>
              featuredRooms.length === 0 ? null : (
                <DiscoverGroup
                  label={<Label>Featured Public Rooms</Label>}
                  content={
                    <DiscoverGroupGrid>
                      {featuredRooms.slice(0, 4).map(([stateKey, stateEvent]) => (
                        <FeaturedRoomCard session={session} platform={platform} roomId={stateKey} />
                      ))}
                    </DiscoverGroupGrid>
                  }
                  footer={
                    featuredRooms.length > 4 && (
                      <div className="flex justify-end">
                        <DiscoverMoreButton
                          onClick={() => onLoadEvents(RepositoryEvents.FeaturedRooms)}
                          text="Browse All Public Rooms"
                          iconSrc={ArrowForwardIC}
                        />
                      </div>
                    )
                  }
                />
              )
            }
          </FeaturedRoomsProvider>
          <FeaturedWorldsProvider room={room}>
            {(featuredWorlds) =>
              featuredWorlds.length === 0 ? null : (
                <DiscoverGroup
                  label={<Label>Featured Public Worlds</Label>}
                  content={
                    <DiscoverGroupGrid>
                      {featuredWorlds.slice(0, 4).map(([stateKey, stateEvent]) => (
                        <FeaturedWorldCard session={session} platform={platform} roomId={stateKey} />
                      ))}
                    </DiscoverGroupGrid>
                  }
                  footer={
                    featuredWorlds.length > 4 && (
                      <div className="flex justify-end">
                        <DiscoverMoreButton
                          onClick={() => onLoadEvents(RepositoryEvents.FeaturedWorlds)}
                          text="Browse All Public Worlds"
                          iconSrc={ArrowForwardIC}
                        />
                      </div>
                    )
                  }
                />
              )
            }
          </FeaturedWorldsProvider>
          <DiscoverGroup
            label={<Label>Featured Scenes</Label>}
            content={
              <DiscoverGroupGrid itemMinWidth={300} gap="md">
                <FeaturedScene onClick={() => false}>
                  <FeaturedSceneThumbnail src={LogoSvg} alt="scene" />
                  <FeaturedSceneContent>
                    <Text variant="b3">Rad Designs</Text>
                    <Text>Zombie city</Text>
                  </FeaturedSceneContent>
                </FeaturedScene>
              </DiscoverGroupGrid>
            }
            footer={
              <div className="flex justify-end">
                <DiscoverMoreButton text="Browse All Scenes" iconSrc={ArrowForwardIC} />
              </div>
            }
          />
        </div>
      </Content>
    </Scroll>
  );
}
