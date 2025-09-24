import { Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import PlayGame from "./pages/PlayGame";
import { useProgress } from "./state/progress";
import { GAMES } from "./games/registry";


export default function App() {
return (
<div className="min-h-screen bg-slate-50">
<NavBar />
<Routes>
<Route path="/" element={<Home />} />
<Route path="/games/:id" element={<PlayGame />} />
</Routes>
</div>
);
}


function NavBar() {
  const { get } = useProgress();
  const total = GAMES.length;
  const cleared = GAMES.filter(g => get(g.id).cleared).length;
  const pct = total ? Math.round((cleared / total) * 100) : 0;

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="mx-auto max-w-6xl p-4 flex items-center gap-6">
        <Link to="/" className="font-semibold">Inequality Games</Link>
        <div className="flex-1" />
        <div className="w-48">
          <div className="text-[11px] text-slate-500 mb-1">Progress: {cleared}/{total} ({pct}%)</div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}