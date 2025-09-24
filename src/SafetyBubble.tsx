/*
Safety Bubble — Simple Walkthrough (Game 2)
Age 10–15 | 2D | React + Tailwind v4 + Framer Motion

Focus: clarity, intuition, visualization of absolute-value inequalities as distance.
- Compulsory walkthrough of 4 tiny, story-led examples. **Only worded prompts**; no target formula is shown.
- Kids adjust **center m**, **radius r**, and **comparator** (≤,<,≥,>) to fit the story. Then press **Check**.
- Move-on control is a large, obvious **Continue** button that unlocks after a correct check.
- Visuals: Number line with a green “safety band” (inside or outside), animated visitor dots, and a speaker icon at m.
- Open Play: short waves; keep ≥85% safe; smaller r earns a badge.

Integration
- Save as src/SafetyBubble.tsx (replaces previous).
- Optional CSS (at bottom comment) for subtle background.
- Registry snippet at bottom.
*/

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Volume2, Info, Lock, Thermometer, Bus, Anchor, Mic } from "lucide-react";
import clsx from "clsx";

// -------------------- Types --------------------

type Domain = { min: number; max: number; step: number; format?: (x: number) => string };

type Comparator = "≤" | "<" | "≥" | ">"; // use real inequality symbols

type Example = {
  id: number;
  title: string;
  prompt: string;
  domain: Domain;
  target: { m: number; r: number; comp: Comparator };
  scene: "thermo" | "bus" | "harbor" | "mic";
};

type Player = { m: number; r: number; comp: Comparator };

type Visitor = { id: string; value: number; accepted: boolean; correct: boolean };

// -------------------- Utils --------------------

const uid = () => Math.random().toString(36).slice(2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const snap = (x: number, s: number) => Math.round(x / s) * s;
const fmt = (x: number) => (Math.abs(x % 1) < 1e-6 ? x.toString() : x.toFixed(1));
const timeFmt = (x: number) => {
  const h = Math.floor(x);
  const m = Math.round((x - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
};

function scaleX(value: number, domain: Domain, px0: number, px1: number) {
  const t = (value - domain.min) / (domain.max - domain.min);
  return px0 + t * (px1 - px0);
}
function unscaleX(px: number, domain: Domain, px0: number, px1: number) {
  const span = px1 - px0 || 1;
  const t = (px - px0) / span;
  return domain.min + t * (domain.max - domain.min);
}

function acceptAbs(x: number, m: number, r: number, comp: Comparator) {
  const d = Math.abs(x - m);
  switch (comp) {
    case "≤": return d <= r + 1e-9;
    case "<": return d <  r - 1e-9;
    case "≥": return d >= r - 1e-9;
    case ">": return d >  r + 1e-9;
  }
}

function equalState(a: Player, b: Player) {
  return Math.abs(a.m - b.m) < 1e-9 && Math.abs(a.r - b.r) < 1e-9 && a.comp === b.comp;
}

function renderAbs(m: number, r: number, c: Comparator) { return `|x − ${fmt(m)}| ${c} ${fmt(r)}`; }
function renderSplit(m: number, r: number, c: Comparator) {
  const L = m - r, U = m + r; const l = fmt(L), u = fmt(U);
  if (c === "≤" || c === "<") { const sl = c === "<" ? "<" : "≤"; const su = c === "<" ? "<" : "≤"; return `${l} ${sl} x ${su} ${u}`; }
  else { const sL = c === ">" ? "<" : "≤"; const sR = c === ">" ? ">" : "≥"; return `x ${sL} ${l}  or  x ${sR} ${u}`; }
}

// -------------------- Walkthrough examples (worded prompts only) --------------------

const EX: Example[] = [
  {
    id: 1,
    scene: "thermo",
    title: "Thermostat",
    prompt:
      "Keep the classroom between 19°C and 23°C, including the edges.",
    domain: { min: 10, max: 30, step: 1 },
    target: { m: 21, r: 2, comp: "≤" },
  },
  {
    id: 2,
    scene: "bus",
    title: "Bus Arrival",
    prompt:
      "Arrive between 17:45 and 18:15, but not exactly at 17:45 or 18:15.",
    domain: {
      min: 17.0,
      max: 19.0,
      step: 0.25,
      format: (x) => timeFmt(x),
    },
    target: { m: 18.0, r: 0.25, comp: "<" },
  },
  {
    id: 3,
    scene: "harbor",
    title: "Harbor Safety",
    prompt:
      "Boats must stay at least 4 km away from the pier at the 8 km marker.",
    domain: { min: 0, max: 16, step: 1 },
    target: { m: 8, r: 4, comp: "≥" },
  },
  {
    id: 4,
    scene: "mic",
    title: "Mic Check",
    prompt:
      "Stand more than 1.5 m from the microphone placed at 6.5 m.",
    domain: { min: 0, max: 12, step: 0.5 },
    target: { m: 6.5, r: 1.5, comp: ">" },
  },
];

const SCENE_BAND: Record<Example["scene"], string> = {
  thermo: "bg-amber-200/60",
  bus: "bg-sky-200/60",
  harbor: "bg-teal-200/60",
  mic: "bg-pink-200/60",
};

const SCENE_BADGE: Record<Example["scene"], string> = {
  thermo: "bg-amber-100 text-amber-700",
  bus: "bg-sky-100 text-sky-700",
  harbor: "bg-teal-100 text-teal-700",
  mic: "bg-pink-100 text-pink-700",
};

const SCENE_ICON = {
  thermo: Thermometer,
  bus: Bus,
  harbor: Anchor,
  mic: Mic,
} as const;

// -------------------- Component --------------------

export default function SafetyBubble({ onCleared, onUpdateBest }: { onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  const [mode, setMode] = useState<"walkthrough" | "open">("walkthrough");
  const [cleared, setCleared] = useState<boolean[]>(Array(EX.length).fill(false));
  const allCleared = cleared.every(Boolean);

  const [idx, setIdx] = useState(0);
  const L = EX[idx];

  const [player, setPlayer] = useState<Player>(() => ({ m: L.target.m, r: L.target.r + 1, comp: L.target.comp }));
  const [checked, setChecked] = useState(false);
  const match = equalState(player, L.target);

  // stream state (for visuals + practice)
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [stream, setStream] = useState(false);
  const [score, setScore] = useState({ total: 0, correct: 0 });

  // reset on level change
  useEffect(() => { setPlayer({ m: L.target.m, r: L.target.r + 1, comp: L.target.comp }); setChecked(false); setVisitors([]); setStream(false); setScore({ total: 0, correct: 0 }); }, [idx]);

  // spawn visitors
  useEffect(() => {
    if (!stream) return;
    const id = setInterval(() => {
      const v = snap(L.domain.min + Math.random() * (L.domain.max - L.domain.min), L.domain.step);
      const accept = acceptAbs(v, player.m, player.r, player.comp);
      const correct = acceptAbs(v, L.target.m, L.target.r, L.target.comp) === accept; // in walkthrough, compare to target silently
      setVisitors((ps) => [{ id: uid(), value: v, accepted: accept, correct }, ...ps.slice(0, 49)]);
      setScore((s) => ({ total: s.total + 1, correct: s.correct + (correct ? 1 : 0) }));
    }, 800);
    return () => clearInterval(id);
  }, [stream, L, player]);

  useEffect(() => { if (mode === "open") onUpdateBest?.(score.total ? Math.round(100 * score.correct / score.total) : 0); }, [mode, score, onUpdateBest]);

  return (
    <div className="min-h-screen bubble-bg">
      <div className="mx-auto max-w-5xl p-6">
        <Header mode={mode} setMode={(m)=> setMode(allCleared? m : "walkthrough")} allCleared={allCleared} score={score} />

        {mode === "walkthrough" ? (
          <Walkthrough
            idx={idx} setIdx={setIdx}
            L={L}
            player={player} setPlayer={setPlayer}
            checked={checked} setChecked={setChecked}
            match={match}
            stream={stream} setStream={setStream}
            visitors={visitors} score={score}
            onContinue={() => {
              const next = [...cleared]; next[idx] = true; setCleared(next);
              if (idx < EX.length - 1) setIdx(idx + 1);
            }}
          />
        ) : (
          <OpenPlay player={player} setPlayer={setPlayer} onCleared={onCleared} onUpdateBest={onUpdateBest} />
        )}
      </div>
    </div>
  );
}

// -------------------- Views --------------------

function Header({ mode, setMode, allCleared, score }: { mode: "walkthrough" | "open"; setMode: (m: "walkthrough" | "open") => void; allCleared: boolean; score: { total: number; correct: number; } }) {
  const acc = score.total ? Math.round(100 * score.correct / score.total) : 0;
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow p-4 border border-indigo-200 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">Safety Bubble</div>
        <div className="text-slate-600 text-sm">Distance as absolute value: move the center m and radius r.</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="text-xs text-slate-500">Practice accuracy</div>
          <div className="text-xl font-bold">{acc}%</div>
        </div>
        <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
          <button onClick={() => setMode("walkthrough")} className={clsx("px-3 py-2 text-sm", mode === "walkthrough" ? "bg-indigo-600 text-white" : "bg-white text-slate-700")}>Walkthrough</button>
          <button onClick={() => allCleared && setMode("open")} className={clsx("px-3 py-2 text-sm flex items-center gap-1", mode === "open" ? "bg-indigo-600 text-white" : "bg-white text-slate-700", !allCleared && "opacity-60")}>{!allCleared && <Lock className="w-4 h-4"/>} Open Play</button>
        </div>
      </div>
    </div>
  );
}

function Walkthrough({ idx, setIdx, L, player, setPlayer, checked, setChecked, match, stream, setStream, visitors, score, onContinue }: {
  idx: number; setIdx: (i: number) => void; L: Example; player: Player; setPlayer: (p: Player) => void; checked: boolean; setChecked: (b: boolean) => void; match: boolean; stream: boolean; setStream: (b: boolean) => void; visitors: Visitor[]; score: { total: number; correct: number }; onContinue: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <LevelHeader
          idx={idx}
          setIdx={setIdx}
          total={EX.length}
          title={L.title}
          scene={L.scene}
        />

        <PromptPanel L={L} />

        <NumberLineAbs
          domain={L.domain}
          player={player}
          setPlayer={setPlayer}
          showComparator
          bandClass={SCENE_BAND[L.scene]}
        />

        <div className="flex items-center gap-3">
          <button className={clsx("px-4 py-2 rounded-xl text-white", match ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")} onClick={() => setChecked(true)}>
            {match ? "Correct!" : "Check"}
          </button>
          {checked && (
            <div className={clsx("text-sm font-medium", match ? "text-emerald-700" : "text-rose-700")}>{match ? "Your bubble matches the story." : "Not yet—tune m, r, or comparator."}</div>
          )}
        </div>

        <div className="mt-2">
          <VisitorsPanel domain={L.domain} visitors={visitors} stream={stream} setStream={setStream} score={score} hint="Start to see who’s safe with **your** rule." />
        </div>

        <div className="mt-3">
          <button
            className={clsx("px-4 py-2 rounded-xl font-semibold", match ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-600 cursor-not-allowed")}
            onClick={() => match && onContinue()}
            aria-disabled={!match}
          >
            {idx < EX.length - 1 ? "Continue to next" : "Finish walkthrough"}
          </button>
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <YourRuleCard player={player} />
        <LegendCard />
      </div>
    </div>
  );
}

function OpenPlay({ player, setPlayer, onCleared, onUpdateBest }: { player: Player; setPlayer: (p: Player) => void; onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  const domain: Domain = { min: -20, max: 20, step: 1 };
  const [stream, setStream] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [score, setScore] = useState({ total: 0, correct: 0 });
  const [radiusCap, setRadiusCap] = useState(8); // badge if r ≤ cap and coverage ≥ 85%

  useEffect(() => {
    if (!stream) return;
    const id = setInterval(() => {
      const v = snap(domain.min + Math.random() * (domain.max - domain.min), domain.step);
      const accept = acceptAbs(v, player.m, player.r, player.comp);
      setVisitors((ps) => [{ id: uid(), value: v, accepted: accept, correct: accept }, ...ps.slice(0, 49)]);
      setScore((s) => ({ total: s.total + 1, correct: s.correct + (accept ? 1 : 0) }));
    }, 650);
    return () => clearInterval(id);
  }, [stream, player]);

  const coverage = score.total ? Math.round(100 * score.correct / score.total) : 0;
  const badge = coverage >= 85 && player.r <= radiusCap;
  useEffect(() => { onUpdateBest?.(coverage); if (badge) onCleared?.(); }, [coverage, player.r, radiusCap, badge, onCleared, onUpdateBest]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Open Play</div>
            <div className="text-lg font-medium">Keep ≥85% visitors safe. Bonus badge if r ≤ {radiusCap}.</div>
            <div className="text-slate-600 text-sm">Your inequality: <span className="font-mono">{renderAbs(player.m, player.r, player.comp)}</span> · Split: <span className="font-mono">{renderSplit(player.m, player.r, player.comp)}</span></div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-600">Radius cap</label>
            <input type="range" min={4} max={12} step={1} value={radiusCap} onChange={(e)=> setRadiusCap(parseInt(e.target.value))} />
            <div className="text-sm font-semibold">{radiusCap}</div>
          </div>
        </div>

        <NumberLineAbs domain={domain} player={player} setPlayer={setPlayer} showComparator />

        <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
          <div className="text-sm uppercase tracking-wide text-slate-500">Controls</div>
          <Controls player={player} setPlayer={setPlayer} domain={domain} />
        </div>

        <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-500">Wave</div>
              <div className="text-slate-600 text-sm">Coverage: <span className="font-bold">{coverage}%</span> {badge && <span className="ml-2 inline-block px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs">Badge!</span>}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className={clsx("px-3 py-1.5 rounded-xl text-white flex items-center gap-2", stream?"bg-amber-600 hover:bg-amber-700":"bg-emerald-600 hover:bg-emerald-700")} onClick={()=> setStream(!stream)}>{stream ? <><Pause className="w-4 h-4"/> Pause</> : <><Play className="w-4 h-4"/> Start</>}</button>
              <button className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center gap-2" onClick={()=> { setStream(false); setVisitors([]); setScore({ total: 0, correct: 0 }); }}><RotateCcw className="w-4 h-4"/> Reset</button>
            </div>
          </div>
          <VisitorsStrip domain={domain} visitors={visitors} />
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <YourRuleCard player={player} />
        <LegendCard />
      </div>
    </div>
  );
}

// -------------------- Panels & Cards --------------------

function LevelHeader({
  idx, setIdx, total, title, scene
}: {
  idx: number; setIdx: (i: number) => void; total: number; title: string; scene: Example["scene"];
}) {
  const BadgeIcon = SCENE_ICON[scene];
  const badgeClass = SCENE_BADGE[scene];

  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`rounded-full w-10 h-10 grid place-items-center font-bold ${badgeClass}`}>
          <BadgeIcon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-500">Walkthrough</div>
          <div className="text-lg font-semibold">{title}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setIdx(Math.max(0, idx - 1))} aria-label="Previous"><ChevronLeft className="w-5 h-5"/></button>
        <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setIdx(Math.min(total - 1, idx + 1))} aria-label="Next"><ChevronRight className="w-5 h-5"/></button>
      </div>
    </div>
  );
}

function PromptPanel({ L }: { L: Example }) {
  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
      <div className="flex items-start gap-3">
        <div className="mt-1"><Info className="w-5 h-5 text-slate-500"/></div>
        <div className="flex-1">
          <div className="text-sm uppercase tracking-wide text-slate-500">Story</div>
          <div className="text-slate-700">{L.prompt}</div>
          <div className="mt-2 text-xs text-slate-600">Translate the words into a bubble on the number line by choosing the center <span className="font-mono">m</span>, radius <span className="font-mono">r</span>, and whether we keep the <em>inside</em> (≤ or &lt;) or the <em>outsides</em> (≥ or &gt;).</div>
        </div>
      </div>
    </div>
  );
}

function YourRuleCard({ player }: { player: Player }) {
  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-1">Your inequality</div>
      <div className="font-mono">{renderAbs(player.m, player.r, player.comp)}</div>
      <div className="text-xs text-slate-600">Split: <span className="font-mono">{renderSplit(player.m, player.r, player.comp)}</span></div>
    </div>
  );
}

function LegendCard() {
  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-1">Legend</div>
      <p className="text-slate-700 mt-1">
        Pick a centre <span className="font-mono">m</span> on the line. Choose a radius <span className="font-mono">r</span>.  
        That makes a safety “bubble” around <span className="font-mono">m</span>.
      </p>
      <p className="text-slate-700 mt-2">
        If we keep the <em>inside</em>, everything from <span className="font-mono">m − r</span> to <span className="font-mono">m + r</span> is safe.
        If we keep the <em>outsides</em>, the middle is unsafe. Switch the comparator to see it flip.
      </p>
    </div>
  );
}

function VisitorsPanel({ domain, visitors, stream, setStream, score, hint }: { domain: Domain; visitors: Visitor[]; stream: boolean; setStream: (b: boolean) => void; score: { total: number; correct: number }; hint?: string }) {
  const accuracy = score.total ? Math.round(100 * score.correct / score.total) : 0;
  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-500">Practice</div>
          <div className="text-slate-600 text-sm">Accuracy: <span className="font-bold">{accuracy}%</span></div>
        </div>
        <div className="flex items-center gap-2">
          <button className={clsx("px-3 py-1.5 rounded-xl text-white flex items-center gap-2", stream?"bg-amber-600 hover:bg-amber-700":"bg-emerald-600 hover:bg-emerald-700")} onClick={()=> setStream(!stream)}>{stream ? <><Pause className="w-4 h-4"/> Pause</> : <><Play className="w-4 h-4"/> Start</>}</button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center gap-2" onClick={()=> { setStream(false); }}>{/* keep data */}Reset</button>
        </div>
      </div>
      <VisitorsStrip domain={domain} visitors={visitors} />
      {hint && <div className="mt-2 text-xs text-slate-600">{hint}</div>}
    </div>
  );
}

// -------------------- Number line --------------------

function NumberLineAbs({
  domain, player, setPlayer, showComparator = false, bandClass
}: {
  domain: Domain;
  player: Player;
  setPlayer: (p: Player) => void;
  showComparator?: boolean;
  bandClass?: string; // NEW
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(0);
  useEffect(() => { const ro = new ResizeObserver(() => setW(ref.current?.clientWidth ?? 0)); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);
  const pad = 20; const width = Math.max(320, W);
  const px0 = pad, px1 = width - pad;
  const sx = (x: number) => scaleX(x, domain, px0, px1);

  const cx = sx(player.m);
  const rPx = (player.r / (domain.max - domain.min)) * (px1 - px0);
  const L = player.m - player.r, U = player.m + player.r;

  function onDragCenter(e: React.MouseEvent) {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const v = snap(clamp(unscaleX(x, domain, px0, px1), domain.min, domain.max), domain.step);
    setPlayer({ ...player, m: v });
  }
  function onDragRadius(e: React.MouseEvent) {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const v = unscaleX(x, domain, px0, px1); let r = Math.abs(v - player.m);
    const maxR = Math.max(0, Math.min(player.m - domain.min, domain.max - player.m));
    r = snap(clamp(r, 0, maxR), domain.step);
    setPlayer({ ...player, r });
  }

  const inclusive = player.comp === "≤" || player.comp === "≥";
  const keepInside = player.comp === "≤" || player.comp === "<";
  const band = bandClass ?? "bg-emerald-200/60";

  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm uppercase tracking-wide text-slate-500">Number Line</div>
        {showComparator && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Comparator</span>
            <ComparatorToggle value={player.comp} onChange={(c)=> setPlayer({ ...player, comp: c })} />
          </div>
        )}
      </div>

      <div className="relative h-28" ref={ref}>
        {/* baseline */}
        <div className="absolute left-5 right-5 top-16 h-0.5 bg-slate-300" />

        {/* shaded bands */}
        {keepInside ? (
          <div className={`absolute top-[56px] h-4 rounded ${band}`} style={{ left: sx(Math.max(domain.min, L)), width: Math.max(0, sx(Math.min(domain.max, U)) - sx(Math.max(domain.min, L))) }} />
        ) : (
          <>
            <div className={`absolute top-[56px] h-4 rounded-l ${band}`} style={{ left: sx(domain.min), width: Math.max(0, sx(Math.max(domain.min, L)) - sx(domain.min)) }} />
            <div className={`absolute top-[56px] h-4 rounded-r ${band}`} style={{ left: sx(Math.min(domain.max, U)), width: Math.max(0, sx(domain.max) - sx(Math.min(domain.max, U))) }} />
          </>
        )}

        {/* ticks */}
        {Array.from({ length: 11 }).map((_, i) => { const x = domain.min + i * (domain.max - domain.min) / 10; const X = sx(x); return (
          <div key={i} className="absolute" style={{ left: X, top: 56 }}>
            <div className="w-px h-6 bg-slate-400" />
            <div className="text-[10px] text-slate-600 text-center -translate-x-1/2 mt-1">{domain.format ? domain.format(x) : fmt(x)}</div>
          </div>
        ); })}

        {/* endpoints */}
        <Endpoint x={sx(L)} label={fmt(L)} open={!inclusive} side="left" />
        <Endpoint x={sx(U)} label={fmt(U)} open={!inclusive} side="right" />

        {/* center (speaker) */}
        <DragHandle x={cx} label={`m=${fmt(player.m)}`} variant="center" onDrag={onDragCenter} />

        {/* radius mirrors */}
        <DragHandle x={cx + rPx} label={`r=${fmt(player.r)}`} variant="radius" onDrag={onDragRadius} />
        <DragHandle x={cx - rPx} label="r" variant="ghost" onDrag={()=>{}} />
      </div>

      <div className="mt-2 text-xs text-slate-600">Drag the <span className="font-semibold">center m</span> and <span className="font-semibold">radius r</span>. Comparator decides whether we keep the inside or the outsides.</div>
    </div>
  );
}

function Endpoint({ x, label, open, side }: { x: number; label: string; open: boolean; side: "left" | "right" }) {
  return (
    <div className="absolute top-12" style={{ left: x, transform: "translateX(-50%)" }}>
      <div className={clsx("w-5 h-5 grid place-items-center rounded-full border-2 shadow", open ? "bg-white border-slate-500" : "bg-slate-800 border-slate-800")}/>
      <div className={clsx("text-xs text-slate-700 mt-1 text-center", side === "left" ? "-ml-4" : "-mr-4")}>{label}</div>
    </div>
  );
}

function DragHandle({ x, label, variant, onDrag }: { x: number; label: string; variant: "center" | "radius" | "ghost"; onDrag: (e: React.MouseEvent) => void }) {
  const [drag, setDrag] = useState(false);
  const style = variant === "center" ? "bg-indigo-600 text-white" : variant === "radius" ? "bg-emerald-600 text-white" : "bg-transparent";
  const border = variant === "ghost" ? "border border-dashed border-emerald-400" : "";
  return (
    <div className="absolute top-12" style={{ left: x, transform: "translateX(-50%)" }} onMouseDown={() => setDrag(true)} onMouseUp={() => setDrag(false)} onMouseLeave={() => setDrag(false)} onMouseMove={(e) => drag && onDrag(e)}>
      <div className={clsx("px-2 py-1 rounded-xl shadow text-xs select-none cursor-ew-resize", style, border)}>{label}</div>
      {variant === "center" && <Volume2 className="w-4 h-4 text-indigo-600 absolute left-1/2 -translate-x-1/2 -bottom-6"/>}
    </div>
  );
}

function ComparatorToggle({ value, onChange }: { value: Comparator; onChange: (c: Comparator) => void }) {
  const opts: Comparator[] = ["≤", "<", "≥", ">"];
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
      {opts.map((c) => (
        <button key={c} onClick={() => onChange(c)} className={clsx("px-3 py-1.5 text-sm font-mono", value === c ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}>{c}</button>
      ))}
    </div>
  );
}

function VisitorsStrip({ domain, visitors }: { domain: Domain; visitors: Visitor[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(0);
  useEffect(() => { const ro = new ResizeObserver(() => setW(ref.current?.clientWidth ?? 0)); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);
  const px0 = 12, px1 = Math.max(12, W - 12);
  return (
    <div className="relative h-28 mt-2 border border-slate-200 rounded-xl overflow-hidden bg-gradient-to-b from-white to-slate-50" ref={ref}>
      <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 bg-slate-300" />
      <AnimatePresence>
        {visitors.map((p) => (
          <motion.div key={p.id} initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ duration: 0.6 }} className="absolute" style={{ left: scaleX(p.value, domain, px0, px1) - 7, top: 12 }}>
            <div className={clsx("w-3.5 h-3.5 rounded-full border shadow", p.correct ? (p.accepted ? "bg-emerald-500 border-emerald-600" : "bg-sky-500 border-sky-600") : "bg-rose-500 border-rose-600")} />
            <div className="text-[10px] text-slate-600 mt-1 text-center">{domain.format ? domain.format(p.value) : fmt(p.value)}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// simple wrapper when used alone
function Controls({ player, setPlayer, domain }: { player: Player; setPlayer: (p: Player) => void; domain: Domain }) {
  return (
    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 text-slate-700">m</span>
        <input type="range" min={domain.min} max={domain.max} step={domain.step} value={player.m} onChange={(e)=> setPlayer({ ...player, m: clamp(parseFloat(e.target.value), domain.min, domain.max) })} className="flex-1"/>
        <span className="font-mono w-12 text-right">{fmt(player.m)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-6 text-slate-700">r</span>
        <input type="range" min={0} max={Math.max(0, domain.max - domain.min)} step={domain.step} value={player.r} onChange={(e)=> setPlayer({ ...player, r: Math.max(0, parseFloat(e.target.value)) })} className="flex-1"/>
        <span className="font-mono w-12 text-right">{fmt(player.r)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-700">Comparator</span>
        <ComparatorToggle value={player.comp} onChange={(c)=> setPlayer({ ...player, comp: c })} />
      </div>
    </div>
  );
}

// -------------------- Registry snippet --------------------
// const SafetyBubble = lazy(() => import("../SafetyBubble"));
// GAMES.push({
//   id: "safety-bubble",
//   title: "Safety Bubble",
//   short: "|x − m| as a distance bubble (story-led).",
//   route: "/games/safety-bubble",
//   estMinutes: 6,
//   difficulty: "intro",
//   tags: ["absolute value", "distance", "number line"],
//   component: SafetyBubble,
// });

// -------------------- Optional CSS --------------------
/* Add to src/index.css for a soft backdrop:
.bubble-bg { background: radial-gradient(900px 450px at 10% -10%, #c7d2fe33, transparent),
                       radial-gradient(900px 450px at 90% 10%, #a7f3d033, transparent),
                       linear-gradient(#f8fafc, #f1f5f9); }
*/
