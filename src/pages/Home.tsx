import React from "react";
import { GAMES } from "../games/registry";
import GameCard from "../components/GameCard";


export default function Home() {
return (
<div className="mx-auto max-w-6xl p-6">
<div className="mb-6">
<h1 className="text-2xl font-bold">Inequality Games</h1>
<p className="text-slate-600">Build intuition through short, connected challenges.</p>
</div>
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
{GAMES.map(g => <GameCard key={g.id} game={g} />)}
</div>
<div className="mt-8 text-sm text-slate-500">
Tip: new games plug in via <code>src/games/registry.tsx</code> — no other wiring needed.
</div>
</div>
);
}