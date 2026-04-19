import { GamePage } from "./game-page";

export async function generateStaticParams() {
  return [{ gameId: "_" }];
}

export default function GameDetailPage() {
  return <GamePage />;
}
