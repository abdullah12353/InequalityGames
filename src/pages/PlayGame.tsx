import React from "react";
import { useParams, Navigate } from "react-router-dom";
import { GAMES } from "../games/registry";
import GameFrame from "../components/GameFrame";


export default function PlayGame() {
const { id } = useParams();
const game = GAMES.find(g => g.id === id);
if (!game) return <Navigate to="/" replace />;
return <GameFrame game={game} />;
}