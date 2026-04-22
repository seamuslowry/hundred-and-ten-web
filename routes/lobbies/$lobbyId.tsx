import { createFileRoute } from "@tanstack/react-router";
import { LobbyDetail } from "@/app/lobbies/[lobbyId]/lobby-detail";

export const Route = createFileRoute("/lobbies/$lobbyId")({
  component: LobbyDetail,
});
