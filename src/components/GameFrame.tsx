import { Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import type { GameMeta } from "../types";
import { useProgress } from "../state/progress";


export default function GameFrame({ game }: { game: GameMeta }) {
const { markPlayed, markCleared, updateBestAccuracy } = useProgress();


useEffect(() => { markPlayed(game.id); }, [game.id]);


const GameComp = game.component;


return (
<div className="mx-auto max-w-6xl p-6">
<div className="flex items-center justify-between mb-4">
<Link to="/" className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900"><ArrowLeft className="w-5 h-5"/> Back</Link>
<div className="text-slate-500 text-sm">{game.title}</div>
<button onClick={() => markCleared(game.id)} className="inline-flex items-center gap-2 text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg text-sm"><Check className="w-4 h-4"/> Mark complete</button>
</div>


<div className="rounded-2xl bg-slate-50 border border-slate-200">
<Suspense fallback={<div className="p-8 text-center text-slate-600">Loading…</div>}>
{/* Optional: pass onCleared so future games can auto-mark */}
<GameComp
onCleared={() => markCleared(game.id)}
onUpdateBest={(acc) => updateBestAccuracy(game.id, acc)}
/>
</Suspense>
</div>
</div>
);
}