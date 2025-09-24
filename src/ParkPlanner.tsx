/*
Park Planner — Game 4 (Single Linear Inequality → Half-Plane)
Theme: City Park Daytime (greens & sky). Variables are Food Stalls (x) and Game Booths (y).
Age: 10–15 | 2D | React + Tailwind v4 + Framer Motion

Spec highlights
- Goal: see ax + by ≤ c (or ≥) as a shaded half‑plane.
- Play: Drag the boundary line via two handles, toggle ≤ / ≥, and test integer plans.
- Math: One inequality at a time; show slope‑intercept and intercepts.
- Levels: Budget cap → Floor‑space cap → Staff cap.
- UI: <Plane2D/> uses SVG with shaded polygon (clipPath‑like via path) and draggable endpoints.

Integration
- Save as src/ParkPlanner.tsx
- Accepts { onCleared?, onUpdateBest? } to feed your dashboard hooks
- Register in src/games/registry.tsx (snippet at bottom)
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Info, Gamepad2, Utensils, ChevronLeft, ChevronRight, RotateCcw, Sparkles } from "lucide-react";
import clsx from "clsx";

// -------------------- Types --------------------

type Comparator = "<=" | "<" | ">=" | ">";

type Domain2D = { xmin: number; xmax: number; ymin: number; ymax: number; step: number };

export type Inequality = { a: number; b: number; c: number; comp: Comparator };

type Pt = { x: number; y: number };

// -------------------- Math utils --------------------

const EPS = 1e-6;
const toFixed1 = (x: number) => (Math.abs(x % 1) < 1e-6 ? x.toString() : x.toFixed(1));
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function lineFromPoints(p1: Pt, p2: Pt) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  let a = dy, b = -dx; // normal (dy, -dx)
  const n = Math.hypot(a, b) || 1; a /= n; b /= n; // unit normal
  if (Math.abs(a) < EPS) { if (b < 0) { a = -a; b = -b; } } else if (a < 0) { a = -a; b = -b; }
  const c = a * p1.x + b * p1.y; // passes through p1
  return { a, b, c };
}

function sameLine(u: { a: number; b: number; c: number }, v: { a: number; b: number; c: number }) {
  const nu = Math.hypot(u.a, u.b) || 1, nv = Math.hypot(v.a, v.b) || 1;
  let ua = u.a / nu, ub = u.b / nu, uc = u.c / nu; let va = v.a / nv, vb = v.b / nv, vc = v.c / nv;
  const fix = (a: number, b: number, c: number) => Math.abs(a) < EPS ? (b < 0 ? { a: -a, b: -b, c: -c } : { a, b, c }) : (a < 0 ? { a: -a, b: -b, c: -c } : { a, b, c });
  ({ a: ua, b: ub, c: uc } = fix(ua, ub, uc)); ({ a: va, b: vb, c: vc } = fix(va, vb, vc));
  return Math.abs(ua - va) < 1e-2 && Math.abs(ub - vb) < 1e-2 && Math.abs(uc - vc) < 1e-2;
}

function insideHalfPlane(x: number, y: number, ineq: Inequality) {
  const s = ineq.a * x + ineq.b * y;
  switch (ineq.comp) {
    case "<=": return s <= ineq.c + 1e-9;
    case "<": return s < ineq.c - 1e-9;
    case ">=": return s >= ineq.c - 1e-9;
    case ">": return s > ineq.c + 1e-9;
  }
}

// Clip viewport rectangle by half-plane (Sutherland–Hodgman for one constraint)
function clipRectByHalfPlane(dom: Domain2D, ineq: Inequality): Pt[] {
  const poly: Pt[] = [
    { x: dom.xmin, y: dom.ymin }, { x: dom.xmax, y: dom.ymin },
    { x: dom.xmax, y: dom.ymax }, { x: dom.xmin, y: dom.ymax },
  ];
  const out: Pt[] = [];
  const inside = (p: Pt) => insideHalfPlane(p.x, p.y, ineq);
  const inter = (p: Pt, q: Pt) => { const dx = q.x - p.x, dy = q.y - p.y; const den = ineq.a * dx + ineq.b * dy; if (Math.abs(den) < 1e-9) return q; const t = (ineq.c - (ineq.a * p.x + ineq.b * p.y)) / den; return { x: p.x + t * dx, y: p.y + t * dy }; };
  let S = poly[poly.length - 1];
  for (const E of poly) { const Sin = inside(S), Ein = inside(E); if (Ein) { if (!Sin) out.push(inter(S, E)); out.push(E); } else if (Sin) { out.push(inter(S, E)); } S = E; }
  return out;
}

function slopeIntercept(a: number, b: number, c: number) { if (Math.abs(b) < 1e-9) return { slope: Infinity, intercept: c / a }; return { slope: -a / b, intercept: c / b }; }
function intercepts(a: number, b: number, c: number) { return { xi: Math.abs(a) < 1e-9 ? undefined : c / a, yi: Math.abs(b) < 1e-9 ? undefined : c / b }; }

// -------------------- Levels --------------------

type Level = {
  id: number; title: string; description: string; domain: Domain2D; target: Inequality;
};

const LEVELS: Level[] = [
  {
    id: 1,
    title: "Budget Cap — Food vs Booths",
    description: "Food stalls cost 2 credits each; booths cost 1. Spend ≤ 12 credits.",
    domain: { xmin: 0, xmax: 12, ymin: 0, ymax: 12, step: 1 },
    target: { a: 2, b: 1, c: 12, comp: "<=" }, // 2x + y ≤ 12
  },
  {
    id: 2,
    title: "Floor Space — Layout",
    description: "Booths take double the space. Total area ≤ 14 units.",
    domain: { xmin: 0, xmax: 14, ymin: 0, ymax: 14, step: 1 },
    target: { a: 1, b: 2, c: 14, comp: "<=" }, // x + 2y ≤ 14
  },
  {
    id: 3,
    title: "Staff — Volunteers Available",
    description: "Each food stall needs 3 staff, each booth needs 2. Staff ≤ 16.",
    domain: { xmin: 0, xmax: 12, ymin: 0, ymax: 12, step: 1 },
    target: { a: 3, b: 2, c: 16, comp: "<=" }, // 3x + 2y ≤ 16
  },
];

// -------------------- Component --------------------

export default function ParkPlanner({ onCleared, onUpdateBest }: { onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  const [mode, setMode] = useState<"examples" | "open">("examples");
  const [idx, setIdx] = useState(0);
  const L = LEVELS[idx];

  // Start near (but not exactly on) the target line
  const initFromTarget = useMemo(() => {
    const { xi, yi } = intercepts(L.target.a, L.target.b, L.target.c);
    const A: Pt = xi !== undefined ? { x: Math.max(L.domain.xmin, Math.min(L.domain.xmax, xi - 1)), y: 0 } : { x: L.domain.xmin + 1, y: (L.target.c) / (L.target.b || 1) };
    const B: Pt = yi !== undefined ? { x: 0, y: Math.max(L.domain.ymin, Math.min(L.domain.ymax, yi - 1)) } : { x: 1, y: (L.target.c - L.target.a) / (L.target.b || 1) };
    return { p1: A, p2: B };
  }, [idx]);

  const [p1, setP1] = useState<Pt>(initFromTarget.p1);
  const [p2, setP2] = useState<Pt>(initFromTarget.p2);
  const [comp, setComp] = useState<Comparator>(L.target.comp);

  useEffect(() => { setP1(initFromTarget.p1); setP2(initFromTarget.p2); setComp(L.target.comp); setX(0); setY(0); setPlaced([]); setScore({ ok: 0, total: 0 }); setChecked(false); setMatched(false); }, [idx]);

  const line = useMemo(() => lineFromPoints(p1, p2), [p1, p2]);
  const player: Inequality = { a: line.a, b: line.b, c: line.c, comp };

  // compare to target
  const targetLine = useMemo(() => {
    const { xi, yi } = intercepts(L.target.a, L.target.b, L.target.c);
    const A: Pt = xi !== undefined ? { x: xi, y: 0 } : { x: 0, y: (L.target.c) / (L.target.b || 1) };
    const B: Pt = yi !== undefined ? { x: 0, y: yi } : { x: 1, y: (L.target.c - L.target.a) / (L.target.b || 1) };
    return lineFromPoints(A, B);
  }, [L]);

  const match = sameLine(line, targetLine) && comp === L.target.comp;

  const [checked, setChecked] = useState(false);
  const [matched, setMatched] = useState(false);
  useEffect(() => { if (checked && match) { setMatched(true); onCleared?.(); onUpdateBest?.(100); } }, [checked, match, onCleared, onUpdateBest]);

  // Plan tester state (integer combos)
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  // Open play stamps
  const [placed, setPlaced] = useState<Pt[]>([]);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const accuracy = score.total ? Math.round((100 * score.ok) / score.total) : 0;
  useEffect(() => { if (mode === "open") onUpdateBest?.(accuracy); }, [accuracy, mode, onUpdateBest]);

  return (
    <div className="min-h-screen park-bg">
      <div className="mx-auto max-w-6xl p-6">
        <Header mode={mode} setMode={setMode} L={L} />

        {mode === "examples" ? (
          <ExamplesView
            L={L}
            p1={p1} p2={p2} setP1={setP1} setP2={setP2}
            comp={comp} setComp={setComp}
            player={player}
            x={x} setX={setX} y={y} setY={setY}
            idx={idx} setIdx={setIdx}
            checked={checked} setChecked={setChecked} matched={matched}
          />
        ) : (
          <OpenPlay
            L={L}
            p1={p1} p2={p2} setP1={setP1} setP2={setP2}
            comp={comp} setComp={setComp}
            player={player}
            placed={placed} setPlaced={setPlaced}
            score={score} setScore={setScore}
            onCleared={onCleared}
          />
        )}

        <AnimatePresence>
          {matched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none">
              <ConfettiOverlay label="Level Matched!" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// -------------------- Views --------------------

function Header({ mode, setMode, L }: { mode: "examples" | "open"; setMode: (m: "examples" | "open") => void; L: Level }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow p-4 flex items-center justify-between border border-emerald-200">
      <div className="flex items-center gap-3">
        <div className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700">{L.title}</div>
        <div className="text-slate-600 text-sm">{L.description}</div>
      </div>
      <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
        <button onClick={() => setMode("examples")} className={clsx("px-3 py-2 text-sm", mode === "examples" ? "bg-emerald-600 text-white" : "bg-white text-slate-700")}>Examples</button>
        <button onClick={() => setMode("open")} className={clsx("px-3 py-2 text-sm", mode === "open" ? "bg-emerald-600 text-white" : "bg-white text-slate-700")}>Open Play</button>
      </div>
    </div>
  );
}

function ExamplesView(props: {
  L: Level; p1: Pt; p2: Pt; setP1: (p: Pt) => void; setP2: (p: Pt) => void;
  comp: Comparator; setComp: (c: Comparator) => void; player: Inequality;
  x: number; setX: (v: number) => void; y: number; setY: (v: number) => void;
  idx: number; setIdx: (i: number) => void; checked: boolean; setChecked: (b: boolean) => void; matched: boolean;
}) {
  const { L, p1, p2, setP1, setP2, comp, setComp, player, x, setX, y, setY, idx, setIdx, checked, setChecked, matched } = props;
  const { slope, intercept } = slopeIntercept(player.a, player.b, player.c);
  const { xi, yi } = intercepts(player.a, player.b, player.c);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl shadow p-4 flex items-center justify-between bg-white/90 border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="rounded-full w-10 h-10 grid place-items-center font-bold bg-emerald-100 text-emerald-700">{L.id}</div>
            <div>
              <div className="text-sm uppercase tracking-wide text-slate-500">Example</div>
              <div className="text-lg font-semibold">{L.title}</div>
              <div className="text-slate-600 text-sm">{L.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setIdx(Math.max(0, idx - 1))}><ChevronLeft className="w-5 h-5"/></button>
            <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setIdx(Math.min(LEVELS.length - 1, idx + 1))}><ChevronRight className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="bg-white/90 rounded-2xl shadow p-4 border border-emerald-200">
          <div className="flex items-start gap-3">
            <div className="mt-1"><Info className="w-5 h-5 text-slate-500"/></div>
            <div className="flex-1">
              <div className="text-sm uppercase tracking-wide text-slate-500">Target</div>
              <div className="font-mono text-lg">{ineqText(L.target)}</div>
              <div className="text-slate-600 text-sm">Drag the line handles and choose the comparator to match this exactly.</div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-700">Comparator</label>
                <ComparatorToggle value={comp} onChange={setComp} />
                <div className="text-sm text-slate-600">Your rule: <span className="font-mono">{ineqText(player)}</span></div>
              </div>

              <div className="mt-2 text-xs text-slate-700 font-mono flex flex-wrap gap-x-4">
                <span>{Number.isFinite(slope) ? `y = ${toFixed1(slope)}x + ${toFixed1(intercept)}` : `x = ${toFixed1(intercept)}`}</span>
                <span>intercepts: {xi !== undefined ? `x=${toFixed1(xi)}` : "—"}, {yi !== undefined ? `y=${toFixed1(yi)}` : "—"}</span>
              </div>

              <div className="mt-4">
                <PlanTester x={x} setX={setX} y={y} setY={setY} player={player} target={L.target} />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button className={clsx("px-4 py-2 rounded-xl text-white", matched ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700")} onClick={() => setChecked(true)}>
                  {matched ? "Perfect Match!" : "Check"}
                </button>
                {checked && (
                  <div className={clsx("text-sm font-medium", matched ? "text-emerald-700" : "text-rose-700")}>{matched ? "Exactly matches the target" : "Not matching yet—adjust the line or ◻"}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Plane2D domain={L.domain} ineq={player} p1={p1} p2={p2} setP1={setP1} setP2={setP2} />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <LegendPanel />
      </div>
    </div>
  );
}

function OpenPlay(props: {
  L: Level; p1: Pt; p2: Pt; setP1: (p: Pt) => void; setP2: (p: Pt) => void; comp: Comparator; setComp: (c: Comparator) => void;
  player: Inequality; placed: Pt[]; setPlaced: (ps: Pt[]) => void; score: { ok: number; total: number }; setScore: (s: { ok: number; total: number }) => void; onCleared?: () => void;
}) {
  const { L, p1, p2, setP1, setP2, comp, setComp, player, placed, setPlaced, score, setScore, onCleared } = props;
  const goal = 10; // place 10 valid plans
  const done = score.ok >= goal;
  useEffect(() => { if (done) onCleared?.(); }, [done, onCleared]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white/90 rounded-2xl shadow p-4 border border-emerald-200 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Open Play</div>
            <div className="text-lg font-medium">Place {goal} valid park plans by clicking integer grid points inside the green region.</div>
            <div className="text-slate-600 text-sm">Current rule: <span className="font-mono">{ineqText(player)}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Comparator</span>
            <ComparatorToggle value={comp} onChange={setComp} />
          </div>
        </div>

        <Plane2D
          domain={L.domain}
          ineq={player}
          p1={p1} p2={p2} setP1={setP1} setP2={setP2}
          placeMode
          onPlace={(pt) => {
            const inside = insideHalfPlane(pt.x, pt.y, player);
            setPlaced([...placed, pt]);
            setScore({ ok: score.ok + (inside ? 1 : 0), total: score.total + 1 });
          }}
        />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white/90 rounded-2xl shadow p-4 border border-emerald-200">
          <div className="text-sm uppercase tracking-wide text-slate-500">Progress</div>
          <div className="text-2xl font-bold">{score.ok} / {goal} valid</div>
          <div className="text-slate-600 text-sm">Total placed: {score.total}</div>
          {done && <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-sm"><CheckCircle2 className="w-4 h-4"/> Cleared!</div>}
          <button className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => { setPlaced([]); setScore({ ok: 0, total: 0 }); }}>
            <RotateCcw className="w-4 h-4 inline-block mr-1"/> Reset
          </button>
        </div>
        <LegendPanel />
      </div>
    </div>
  );
}

// -------------------- Plane2D (SVG) --------------------

function Plane2D({ domain, ineq, p1, p2, setP1, setP2, placeMode = false, onPlace }: {
  domain: Domain2D; ineq: Inequality; p1: Pt; p2: Pt; setP1: (p: Pt) => void; setP2: (p: Pt) => void; placeMode?: boolean; onPlace?: (pt: Pt) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => { const ro = new ResizeObserver(() => setSize({ w: ref.current?.clientWidth ?? 0, h: ref.current?.clientHeight ?? 0 })); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);

  const pad = 24; const W = Math.max(320, size.w), H = Math.max(280, size.h);
  const sx = (x: number) => pad + ((x - domain.xmin) / (domain.xmax - domain.xmin)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - domain.ymin) / (domain.ymax - domain.ymin)) * (H - 2 * pad);
  const ux = (px: number) => domain.xmin + ((px - pad) / (W - 2 * pad)) * (domain.xmax - domain.xmin);
  const uy = (py: number) => domain.ymin + (((H - pad) - py) / (H - 2 * pad)) * (domain.ymax - domain.ymin);

  const poly = clipRectByHalfPlane(domain, ineq);
  const polyPath = poly.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x)},${sy(p.y)}`).join(" ") + (poly.length ? " Z" : "");

  const boundary = boundarySegment(domain, { a: ineq.a, b: ineq.b, c: ineq.c });

  const [drag, setDrag] = useState<null | "A" | "B">(null);
  function onMove(e: React.MouseEvent) { if (!drag) return; const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); const x = ux(e.clientX - rect.left), y = uy(e.clientY - rect.top); const q = { x: clamp(x, domain.xmin, domain.xmax), y: clamp(y, domain.ymin, domain.ymax) }; if (drag === "A") setP1(q); else setP2(q); }
  function onClick(e: React.MouseEvent) { if (!placeMode || !onPlace) return; const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect(); const x = ux(e.clientX - rect.left), y = uy(e.clientY - rect.top); const gx = Math.round(x), gy = Math.round(y); if (gx < domain.xmin || gx > domain.xmax || gy < domain.ymin || gy > domain.ymax) return; onPlace({ x: gx, y: gy }); }

  return (
    <div className="rounded-2xl shadow overflow-hidden border border-emerald-300" ref={ref}>
      <div className="relative" onMouseMove={onMove} onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)} onClick={onClick}>
        <svg width={W} height={H} className="block bg-day">
          <defs>
            <linearGradient id="parkLine" x1="0" x2="1">
              <stop offset="0%" stopColor="#34d399"/>
              <stop offset="100%" stopColor="#86efac"/>
            </linearGradient>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#0b122015" strokeWidth="1"/>
            </pattern>
            <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* background grid */}
          <rect x={0} y={0} width={W} height={H} fill="url(#grid)" />

          {/* axes */}
          <line x1={sx(domain.xmin)} y1={sy(0)} x2={sx(domain.xmax)} y2={sy(0)} stroke="#0b122055" strokeWidth={1} />
          <line x1={sx(0)} y1={sy(domain.ymin)} x2={sx(0)} y2={sy(domain.ymax)} stroke="#0b122055" strokeWidth={1} />

          {/* shaded half-plane */}
          {poly.length >= 3 && (
            <path d={polyPath} fill="#10b98133" stroke="none" />
          )}

          {/* integer lattice in place mode (for clicking) */}
          {placeMode && (
            <g>
              {Array.from({ length: (domain.xmax - domain.xmin + 1) * (domain.ymax - domain.ymin + 1) }).map((_, k) => {
                const i = k % (domain.xmax - domain.xmin + 1);
                const j = Math.floor(k / (domain.xmax - domain.xmin + 1));
                const x = domain.xmin + i; const y = domain.ymin + j;
                return <circle key={k} cx={sx(x)} cy={sy(y)} r={1.5} fill="#0b122033"/>;
              })}
            </g>
          )}

          {/* boundary line segment */}
          {boundary && (
            <g filter="url(#soft)">
              <line x1={sx(boundary.p.x)} y1={sy(boundary.p.y)} x2={sx(boundary.q.x)} y2={sy(boundary.q.y)} stroke="url(#parkLine)" strokeWidth={3} />
              {/* solid caps for ≤/≥, hollow for </> */}
              <circle cx={sx(boundary.p.x)} cy={sy(boundary.p.y)} r={6} fill={ineq.comp === "<" || ineq.comp === ">" ? "#e0f2fe" : "#86efac"} stroke="#34d399" strokeWidth={2} />
              <circle cx={sx(boundary.q.x)} cy={sy(boundary.q.y)} r={6} fill={ineq.comp === "<" || ineq.comp === ">" ? "#e0f2fe" : "#86efac"} stroke="#34d399" strokeWidth={2} />
            </g>
          )}

          {/* draggable handles */}
          <g>
            <Handle cx={sx(p1.x)} cy={sy(p1.y)} label="A" onDown={() => setDrag("A")} />
            <Handle cx={sx(p2.x)} cy={sy(p2.y)} label="B" onDown={() => setDrag("B")} />
          </g>

          {/* axis labels */}
          <text x={sx(domain.xmax) - 8} y={sy(0) - 6} textAnchor="end" fontSize={10} fill="#065f46">Food Stalls x</text>
          <text x={sx(0) + 6} y={sy(domain.ymax) + 12} fontSize={10} fill="#065f46">Game Booths y</text>
        </svg>

        {/* floating comparator (display only) */}
        <div className="absolute top-3 right-3 bg-white/90 rounded-xl border border-emerald-300 px-2 py-1 text-emerald-700 text-sm font-mono">{ineq.comp}</div>

        {/* current inequality */}
        <div className="absolute bottom-3 left-3 bg-white/90 rounded-xl border border-emerald-300 px-3 py-1 text-emerald-700 font-mono text-sm">{ineqText(ineq)}</div>
      </div>
    </div>
  );
}

function boundarySegment(dom: Domain2D, line: { a: number; b: number; c: number }) {
  const edges = [
    { p: { x: dom.xmin, y: dom.ymin }, q: { x: dom.xmin, y: dom.ymax } },
    { p: { x: dom.xmax, y: dom.ymin }, q: { x: dom.xmax, y: dom.ymax } },
    { p: { x: dom.xmin, y: dom.ymin }, q: { x: dom.xmax, y: dom.ymin } },
    { p: { x: dom.xmin, y: dom.ymax }, q: { x: dom.xmax, y: dom.ymax } },
  ];
  const pts: Pt[] = [];
  for (const e of edges) {
    const dx = e.q.x - e.p.x, dy = e.q.y - e.p.y; const den = line.a * dx + line.b * dy; if (Math.abs(den) < 1e-9) continue; const t = (line.c - (line.a * e.p.x + line.b * e.p.y)) / den; if (t >= -1e-6 && t <= 1 + 1e-6) { const X = { x: e.p.x + t * dx, y: e.p.y + t * dy }; if (X.x >= dom.xmin - 1e-6 && X.x <= dom.xmax + 1e-6 && X.y >= dom.ymin - 1e-6 && X.y <= dom.ymax + 1e-6) pts.push(X); }
  }
  if (pts.length < 2) return null;
  let best: [Pt, Pt] = [pts[0], pts[1]]; let d = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dd = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y); if (dd > d) { d = dd; best = [pts[i], pts[j]]; } }
  return { p: best[0], q: best[1] };
}

function Handle({ cx, cy, label, onDown }: { cx: number; cy: number; label: string; onDown: () => void }) {
  return (
    <g onMouseDown={onDown} style={{ cursor: "grab" }}>
      <circle cx={cx} cy={cy} r={8} fill="#34d399" stroke="#065f46" strokeWidth={2} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} fill="#065f46">{label}</text>
    </g>
  );
}

// -------------------- UI bits --------------------

function PlanTester({ x, setX, y, setY, player, target }: { x: number; setX: (v: number) => void; y: number; setY: (v: number) => void; player: Inequality; target: Inequality }) {
  const targetOK = insideHalfPlane(x, y, target);
  const yoursOK = insideHalfPlane(x, y, player);
  return (
    <div className="rounded-2xl p-3 border border-emerald-200 bg-white/80">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-1">Test a concrete plan</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <Counter label="Food Stalls x" Icon={Utensils} value={x} onChange={(v) => setX(clamp(v, 0, 50))} />
        <Counter label="Game Booths y" Icon={Gamepad2} value={y} onChange={(v) => setY(clamp(v, 0, 50))} />
      </div>
      <div className="mt-2 font-mono text-sm">a·x + b·y ◻ c → {toFixed1(player.a)}·{x} + {toFixed1(player.b)}·{y} {player.comp} {toFixed1(player.c)}</div>
      <div className="mt-2 flex gap-3 text-sm">
        <Status tag="Target" ok={targetOK} />
        <Status tag="Your rule" ok={yoursOK} />
      </div>
    </div>
  );
}

function Counter({ label, Icon, value, onChange }: { label: string; Icon: React.FC<any>; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-emerald-700" />
      <span className="text-sm w-28 text-slate-700">{label}</span>
      <div className="inline-flex items-center rounded-xl border border-slate-200 overflow-hidden">
        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200" onClick={() => onChange(value - 1)}>-</button>
        <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value || "0"))} className="w-16 text-center outline-none" />
        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200" onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function Status({ tag, ok }: { tag: string; ok: boolean }) {
  return <div className={clsx("px-2 py-1 rounded-lg text-xs font-semibold", ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{tag}: {ok ? "Accept" : "Reject"}</div>;
}

function ComparatorToggle({ value, onChange }: { value: Comparator; onChange: (c: Comparator) => void }) {
  const opts: { label: string; val: Comparator }[] = [
    { label: "≤", val: "<=" }, { label: "<", val: "<" }, { label: "≥", val: ">=" }, { label: ">", val: ">" },
  ];
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
      {opts.map(({ label, val }) => (
        <button key={val} onClick={() => onChange(val)} className={clsx("px-3 py-1.5 text-sm font-mono", value === val ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}>{label}</button>
      ))}
    </div>
  );
}

function LegendPanel() {
  return (
    <div className="bg-white/90 rounded-2xl shadow p-4 border border-emerald-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Legend</div>
      <ul className="space-y-1 text-sm text-slate-700">
        <li>• Boundary line: <span className="font-mono">ax + by = c</span>.</li>
        <li>• Green shade obeys <span className="font-mono">ax + by ◻ c</span>.</li>
        <li>• "≤" vs "≥" picks which side is shaded ("&lt;"/"&gt;" excludes the line).</li>
        <li>• x: Food Stalls, y: Game Booths.</li>
      </ul>
    </div>
  );
}

function ineqText(ineq: Inequality) { return `${toFixed1(ineq.a)}x + ${toFixed1(ineq.b)}y ${ineq.comp} ${toFixed1(ineq.c)}`; }

function ConfettiOverlay({ label }: { label: string }) {
  const pieces = Array.from({ length: 70 }).map(() => ({ id: Math.random().toString(36).slice(2), x: Math.random() * 100, d: 30 + Math.random() * 60, r: Math.random() * 360 }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <motion.div key={p.id} initial={{ x: `${p.x}vw`, y: -40, rotate: p.r, opacity: 0 }} animate={{ x: `${p.x + (Math.random() * 20 - 10)}vw`, y: `${p.d}vh`, rotate: p.r + 180, opacity: 1 }} transition={{ duration: 1.2 + Math.random() * 0.8, ease: "easeOut" }} className="w-2 h-3 rounded-sm" style={{ background: ["#34d399", "#86efac", "#fde68a"][Math.floor(Math.random() * 3)] }} />
      ))}
      <div className="absolute inset-x-0 top-10 flex justify-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 shadow text-emerald-700 font-semibold"><Sparkles className="w-5 h-5"/> {label}</span>
      </div>
    </div>
  );
}
