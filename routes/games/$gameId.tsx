import { createFileRoute } from "@tanstack/react-router";
import { GamePage } from "@/app/games/[gameId]/game-page";

export const Route = createFileRoute("/games/$gameId")({
  component: GamePage,
});
