import { LobbyDetail } from "./lobby-detail";

export async function generateStaticParams() {
  return [{ lobbyId: "_" }];
}

export default function LobbyDetailPage() {
  return <LobbyDetail />;
}
