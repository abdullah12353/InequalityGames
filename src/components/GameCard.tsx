import { Link } from "react-router-dom";
import type { GameMeta } from "../types";
import { Star, Timer } from "lucide-react";
import { useProgress } from "../state/progress";


export default function GameCard({ game }: { game: GameMeta }) {
const { get } = useProgress();
const p = get(game.id);
return (
<div className="rounded-2xl bg-white shadow p-4 flex flex-col">
<div className="flex items-center justify-between">
<div className="flex items-center gap-2">
<div className="text-slate-600">{game.icon}</div>
<h3 className="text-lg font-semibold">{game.title}</h3>
</div>
{p.cleared && (
<span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded-lg text-xs"><Star className="w-4 h-4"/> Cleared</span>
)}
</div>
<p className="text-slate-600 text-sm mt-2 flex-1">{game.short}</p>
<div className="flex items-center justify-between mt-3 text-sm text-slate-600">
<span className="inline-flex items-center gap-1"><Timer className="w-4 h-4"/> {game.estMinutes} min</span>
<span className="capitalize">{game.difficulty}</span>
</div>
{p.bestAccuracy != null && (
  <div className="mt-2 text-sm text-slate-600">Best accuracy: {p.bestAccuracy}%</div>
)}
<Link to={game.route} className="mt-4 inline-flex justify-center items-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2">Play</Link>
</div>
);
}