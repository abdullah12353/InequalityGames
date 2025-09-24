/*
Half-Plane Hero — Game 3 (Refined for relevance)
Theme: Neon Night Market with scenario-specific visuals & accent colour per example.
Age: 10–15 | 2D | React + Tailwind v4 + Framer Motion

Changes per feedback
- Removed generic patron stream; no random dots.
- Each example now shows scenario-relevant UI (icons, counters) + per-level accent.
- Students test concrete integer plans with counters (x & y) and see Target vs Your Rule.
- Open Play: students place integer points on the grid; earn clears by placing valid plans.

Integration
- Save as src/HalfPlaneHero.tsx
- Accepts { onCleared?, onUpdateBest? } for your dashboard hooks
- Add CSS helpers to src/index.css (see bottom comment) for the background vibe
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, RotateCcw, Info, Sparkles,
  Gamepad2, Utensils, Tent, Users, Megaphone, Crown,
} from "lucide-react";
import clsx from "clsx";

// -------------------- Types --------------------

type Comparator = "<=" | "<" | ">=" | ">";

type Domain2D = { xmin: number; xmax: number; ymin: number; ymax: number; step: number };

export type Inequality = { a: number; b: number; c: number; comp: Comparator };

type Pt = { x: number; y: number };

type Accent = "amber" | "cyan" | "emerald" | "fuchsia" | "rose";

function accentClasses(accent: Accent) {
  const map: Record<Accent, { btn: string; btnHover: string; chip: string; border: string; glowA: string; glowB: string }> = {
    amber:   { btn: "bg-amber-600",   btnHover: "hover:bg-amber-700",   chip: "bg-amber-100 text-amber-700",   border: "border-amber-300",  glowA: "#f59e0b", glowB: "#fde68a" },
    cyan:    { btn: "bg-cyan-600",    btnHover: "hover:bg-cyan-700",    chip: "bg-cyan-100 text-cyan-700",     border: "border-cyan-300",   glowA: "#06b6d4", glowB: "#a5f3fc" },
    emerald: { btn: "bg-emerald-600", btnHover: "hover:bg-emerald-700", chip: "bg-emerald-100 text-emerald-700", border: "border-emerald-300", glowA: "#10b981", glowB: "#a7f3d0" },
    fuchsia: { btn: "bg-fuchsia-600", btnHover: "hover:bg-fuchsia-700", chip: "bg-fuchsia-100 text-fuchsia-700", border: "border-fuchsia-300", glowA: "#d946ef", glowB: "#f5d0fe" },
    rose:    { btn: "bg-rose-600",    btnHover: "hover:bg-rose-700",    chip: "bg-rose-100 text-rose-700",     border: "border-rose-300",    glowA: "#f43f5e", glowB: "#fecdd3" },
  };
  return map[accent];
}

// -------------------- Math utils --------------------

const EPS = 1e-6;
const toFixed1 = (x: number) => (Math.abs(x % 1) < 1e-6 ? x.toString() : x.toFixed(1));
function clamp(x: number, a: number, b: number) { return Math.max(a, Math.min(b, x)); }

function lineFromPoints(p1: Pt, p2: Pt) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  let a = dy, b = -dx; // normal (dy, -dx)
  const n = Math.hypot(a,b) || 1; a/=n; b/=n; // unit normal
  if (Math.abs(a) < EPS) { if (b < 0) { a=-a; b=-b; } } else if (a < 0) { a=-a; b=-b; }
  const c = a*p1.x + b*p1.y; // passes through p1
  return { a, b, c };
}

function sameLine(u: {a:number;b:number;c:number}, v: {a:number;b:number;c:number}) {
  const nu = Math.hypot(u.a,u.b)||1, nv=Math.hypot(v.a,v.b)||1;
  let ua=u.a/nu, ub=u.b/nu, uc=u.c/nu; let va=v.a/nv, vb=v.b/nv, vc=v.c/nv;
  const fix=(a:number,b:number,c:number)=> Math.abs(a)<EPS ? (b<0?{a:-a,b:-b,c:-c}:{a,b,c}) : (a<0?{a:-a,b:-b,c:-c}:{a,b,c});
  ({a:ua,b:ub,c:uc}=fix(ua,ub,uc)); ({a:va,b:vb,c:vc}=fix(va,vb,vc));
  return Math.abs(ua-va)<1e-2 && Math.abs(ub-vb)<1e-2 && Math.abs(uc-vc)<1e-2;
}

function insideHalfPlane(x:number,y:number,ineq:Inequality){
  const s = ineq.a*x + ineq.b*y;
  switch(ineq.comp){
    case "<=": return s <= ineq.c + 1e-9;
    case "<":  return s <  ineq.c - 1e-9;
    case ">=": return s >= ineq.c - 1e-9;
    case ">":  return s >  ineq.c + 1e-9;
  }
}

function clipRectByHalfPlane(dom:Domain2D, ineq:Inequality): Pt[] {
  const poly: Pt[] = [
    { x: dom.xmin, y: dom.ymin }, { x: dom.xmax, y: dom.ymin },
    { x: dom.xmax, y: dom.ymax }, { x: dom.xmin, y: dom.ymax },
  ];
  const out: Pt[] = [];
  const inside = (p:Pt)=> insideHalfPlane(p.x,p.y,ineq);
  const inter = (p:Pt,q:Pt)=>{ const dx=q.x-p.x, dy=q.y-p.y; const den=ineq.a*dx+ineq.b*dy; if(Math.abs(den)<1e-9) return q; const t=(ineq.c-(ineq.a*p.x+ineq.b*p.y))/den; return {x:p.x+t*dx,y:p.y+t*dy}; };
  let S=poly[poly.length-1];
  for(const E of poly){ const Sin=inside(S), Ein=inside(E); if(Ein){ if(!Sin) out.push(inter(S,E)); out.push(E);} else if(Sin){ out.push(inter(S,E)); } S=E; }
  return out;
}

function slopeIntercept(a:number,b:number,c:number){ if(Math.abs(b)<1e-9) return { slope: Infinity, intercept: c/a }; return { slope: -a/b, intercept: c/b }; }
function intercepts(a:number,b:number,c:number){ return { xi: Math.abs(a)<1e-9?undefined:c/a, yi: Math.abs(b)<1e-9?undefined:c/b }; }

// -------------------- Example Levels (scenario + accent) --------------------

type Scenario = { xLabel: string; yLabel: string; XIcon: React.FC<any>; YIcon: React.FC<any>; accent: Accent };

type ExampleLevel = {
  id: number;
  title: string;
  description: string;
  domain: Domain2D;
  target: Inequality;
  scen: Scenario;
};

const EX_LEVELS: ExampleLevel[] = [
  {
    id: 1,
    title: "Budget Line — Snacks & Booths",
    description: "Each snack stall costs 2 credits and each game booth costs 1. Spend at most 12 credits.",
    domain: { xmin: 0, xmax: 12, ymin: 0, ymax: 12, step: 1 },
    target: { a: 2, b: 1, c: 12, comp: "<=" },
    scen: { xLabel: "Snacks", yLabel: "Booths", XIcon: Utensils, YIcon: Gamepad2, accent: "amber" },
  },
  {
    id: 2,
    title: "Space Constraint — Tents vs. Arcades",
    description: "Arcades take double space. Total space ≤ 14 units.",
    domain: { xmin: 0, xmax: 14, ymin: 0, ymax: 14, step: 1 },
    target: { a: 1, b: 2, c: 14, comp: "<=" },
    scen: { xLabel: "Tents", yLabel: "Arcades", XIcon: Tent, YIcon: Gamepad2, accent: "cyan" },
  },
  {
    id: 3,
    title: "Minimum Staff — Safety Team",
    description: "You need at least 10 staff credits (snacks use 3, booths use 2).",
    domain: { xmin: 0, xmax: 12, ymin: 0, ymax: 12, step: 1 },
    target: { a: 3, b: 2, c: 10, comp: ">=" },
    scen: { xLabel: "Snack staff", yLabel: "Booth staff", XIcon: Users, YIcon: Users, accent: "emerald" },
  },
  {
    id: 4,
    title: "Noise Barrier — Stay Above",
    description: "Your music must be strictly louder than the rival line.",
    domain: { xmin: 0, xmax: 12, ymin: 0, ymax: 12, step: 1 },
    target: { a: 1, b: 1, c: 6, comp: ">" },
    scen: { xLabel: "Stage A", yLabel: "Stage B", XIcon: Megaphone, YIcon: Megaphone, accent: "fuchsia" },
  },
  {
    id: 5,
    title: "VIP Mix — Below Strictly",
    description: "Only plans strictly under the taste line are allowed.",
    domain: { xmin: 0, xmax: 12, ymin: 0, ymax: 12, step: 1 },
    target: { a: 1, b: -1, c: 3, comp: "<" },
    scen: { xLabel: "Sweet", yLabel: "Sour", XIcon: Crown, YIcon: Crown, accent: "rose" },
  },
];

// -------------------- Component --------------------

export default function HalfPlaneHero({ onCleared, onUpdateBest }: { onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  const [mode, setMode] = useState<"walkthrough" | "open">("walkthrough");
  const [introDone, setIntroDone] = useState(false);
  const [idx, setIdx] = useState(0);
  const [cleared, setCleared] = useState<boolean[]>(Array(EX_LEVELS.length).fill(false));
  const allCleared = cleared.every(Boolean);

  const L = EX_LEVELS[idx];
  const ACC = accentClasses(L.scen.accent);

  // boundary through two draggable points
  const initP1 = useMemo(() => ({ x: L.domain.xmin + 2, y: L.domain.ymax - 2 }), [idx]);
  const initP2 = useMemo(() => ({ x: L.domain.xmax - 2, y: L.domain.ymin + 2 }), [idx]);
  const [p1, setP1] = useState<Pt>(initP1);
  const [p2, setP2] = useState<Pt>(initP2);
  const [comp, setComp] = useState<Comparator>(L.target.comp);

  useEffect(() => { setP1(initP1); setP2(initP2); setComp(L.target.comp); setChecked(false); setMatched(false); }, [idx]);

  const line = useMemo(() => lineFromPoints(p1, p2), [p1, p2]);
  const player: Inequality = { a: line.a, b: line.b, c: line.c, comp };

  // compare to target
  const targetLine = useMemo(() => {
    const { xi, yi } = intercepts(L.target.a, L.target.b, L.target.c);
    const A: Pt = xi !== undefined ? { x: clamp(xi, L.domain.xmin, L.domain.xmax), y: 0 } : { x: 0, y: (L.target.c) / (L.target.b || 1) };
    const B: Pt = yi !== undefined ? { x: 0, y: clamp(yi, L.domain.ymin, L.domain.ymax) } : { x: 1, y: (L.target.c - L.target.a) / (L.target.b || 1) };
    return lineFromPoints(A,B);
  }, [L]);
  const match = sameLine(line, targetLine) && comp === L.target.comp;

  const [checked, setChecked] = useState(false);
  const [matched, setMatched] = useState(false);
  useEffect(() => {
    if (checked && match) {
      setMatched(true);
      const next = [...cleared];
      next[idx] = true;
      // record as cleared for walkthrough progression
      // (we still call dashboard hooks as before)
      setCleared(next);
      onCleared?.();
      onUpdateBest?.(100);
    }
  }, [checked, match, idx, cleared, onCleared, onUpdateBest]);

  return (
    <div className="min-h-screen neon-bg">
      <div className="mx-auto max-w-6xl p-6">
        <Header mode={mode} setMode={(m)=> setMode(m === "open" && !allCleared ? "walkthrough" : m)} L={L} ACC={ACC} allCleared={allCleared} />

        {mode === "walkthrough" ? (
          !introDone ? (
            <IntroCard
              scen={L.scen}
              domain={L.domain}
              onBegin={()=> setIntroDone(true)}
            />
          ) : (
            <ExamplesView
              L={L} ACC={ACC}
              idx={idx} setIdx={setIdx}
              p1={p1} p2={p2} setP1={setP1} setP2={setP2}
              comp={comp} setComp={setComp}
              player={player} match={match}
              checked={checked} setChecked={setChecked}
              onContinue={()=>{
                if (idx < EX_LEVELS.length - 1) setIdx(idx+1);
              }}
            />
          )
        ) : (
          <OpenPlayView
            L={L} ACC={ACC}
            p1={p1} p2={p2} setP1={setP1} setP2={setP2}
            comp={comp} setComp={setComp}
            onCleared={onCleared}
            onUpdateBest={onUpdateBest}
          />
        )}

        <AnimatePresence>
          {matched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none">
              <ConfettiOverlay label="Level Matched!" colorA={ACC.glowA} colorB={ACC.glowB} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// -------------------- Intro Card --------------------

function IntroCard({
  scen, domain, onBegin
}: {
  scen: Scenario; domain: Domain2D; onBegin: () => void;
}) {
  // simple live demo line: x + y ≤ 8
  const [p1, setP1] = useState<Pt>({ x: domain.xmin + 1, y: domain.ymax - 1 });
  const [p2, setP2] = useState<Pt>({ x: domain.xmax - 1, y: domain.ymin + 1 });
  const [comp, setComp] = useState<Comparator>("<=");
  const ineq = { ...lineFromPoints(p1, p2), comp } as Inequality;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
          <div className="text-sm uppercase tracking-wide text-slate-500">Introduction</div>
          <div className="text-lg font-semibold">A line splits the world; an inequality keeps one side.</div>
          <p className="text-slate-700 mt-2">
            Drag the two handles to set a boundary line. Choose a comparator to keep the
            side that matches your plan. The green region is every <em>integer plan</em> that obeys your rule.
          </p>
          <p className="text-slate-700 mt-1">
            The axes show your choices: <strong>{scen.xLabel}</strong> (x-axis) and <strong>{scen.yLabel}</strong> (y-axis).
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-slate-700">Comparator</span>
            <ComparatorToggle value={comp} onChange={setComp} />
          </div>
        </div>

        <NeonPlane
          domain={domain}
          ineq={ineq}
          p1={p1} p2={p2} setP1={setP1} setP2={setP2}
          ACC={accentClasses("emerald")}
          axisLabels={{ x: scen.xLabel, y: scen.yLabel }}
        />

        <button className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700" onClick={onBegin}>
          Begin Walkthrough
        </button>
      </div>

      <div className="lg:col-span-1">
        <div className="bg-white/90 rounded-2xl shadow p-4 border border-indigo-200">
          <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Key ideas</div>
          <ul className="text-sm text-slate-700 space-y-1">
            <li>• <span className="font-mono">ax + by = c</span> is a line.</li>
            <li>• <span className="font-mono">ax + by ≤ c</span> keeps the side under/left of the line (including the edge).</li>
            <li>• <span className="font-mono">ax + by &lt; c</span> is the same side but <em>without</em> the edge.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// -------------------- Views --------------------

function Header({ mode, setMode, L, ACC, allCleared }: {
  mode: "walkthrough" | "open";
  setMode: (m: "walkthrough" | "open") => void;
  L: ExampleLevel;
  ACC: ReturnType<typeof accentClasses>;
  allCleared: boolean;
}) {
  return (
    <div className={clsx("bg-white/90 backdrop-blur rounded-2xl shadow p-4 flex items-center justify-between border", ACC.border)}>
      <div className="flex items-center gap-3">
        <div className={clsx("px-2 py-1 rounded-lg text-xs font-semibold", ACC.chip)}>{L.title}</div>
        <div className="text-slate-600 text-sm">{L.description}</div>
      </div>
      <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
        <button onClick={() => setMode("walkthrough")} className={clsx("px-3 py-2 text-sm", mode === "walkthrough" ? `${ACC.btn} text-white` : "bg-white text-slate-700")}>Walkthrough</button>
        <button
          onClick={() => allCleared && setMode("open")}
          className={clsx(
            "px-3 py-2 text-sm",
            mode === "open" ? `${ACC.btn} text-white` : "bg-white text-slate-700",
            !allCleared && "opacity-60 cursor-not-allowed"
          )}
          title={allCleared ? "Open Play" : "Finish the walkthrough to unlock"}
        >
          Open Play
        </button>
      </div>
    </div>
  );
}

function ExamplesView({ L, ACC, idx, setIdx, p1, p2, setP1, setP2, comp, setComp, player, match, checked, setChecked, onContinue }: {
  L: ExampleLevel; ACC: ReturnType<typeof accentClasses>;
  idx:number; setIdx:(i:number)=>void;
  p1:Pt; p2:Pt; setP1:(p:Pt)=>void; setP2:(p:Pt)=>void;
  comp:Comparator; setComp:(c:Comparator)=>void; player:Inequality; match:boolean; checked:boolean; setChecked:(b:boolean)=>void;
  onContinue: () => void;
}) {
  const { slope, intercept } = slopeIntercept(player.a, player.b, player.c);
  const { xi, yi } = intercepts(player.a, player.b, player.c);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <LevelHeader idx={idx} setIdx={setIdx} total={EX_LEVELS.length} L={L} ACC={ACC} />

        <div className={clsx("bg-white/90 rounded-2xl shadow p-4", ACC.border, "border") }>
          <div className="flex items-start gap-3">
            <div className="mt-1"><Info className="w-5 h-5 text-slate-500"/></div>
            <div className="flex-1">
              <div className="text-sm uppercase tracking-wide text-slate-500">Target</div>
              <div className="font-mono text-lg">{ineqText(L.target)}</div>
              <div className="text-slate-600 text-sm">Drag the neon boundary and choose the comparator to match this exactly.</div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-700">Comparator</label>
                <ComparatorToggle value={comp} onChange={setComp} />
                <div className="text-sm text-slate-600">Your boundary: <span className="font-mono">{ineqText(player)}</span></div>
              </div>
              <div className="mt-2 text-xs text-slate-700 font-mono flex flex-wrap gap-x-4">
                <span>{Number.isFinite(slope) ? `y = ${toFixed1(slope)}x + ${toFixed1(intercept)}` : `x = ${toFixed1(intercept)}`}</span>
                <span>intercepts: {xi!==undefined?`x=${toFixed1(xi)}`:"—"}, {yi!==undefined?`y=${toFixed1(yi)}`:"—"}</span>
              </div>
              <div className="mt-4">
                <PlanTester L={L} player={player} ACC={ACC} />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  className={clsx("px-4 py-2 rounded-xl text-white", match ? "bg-emerald-600 hover:bg-emerald-700" : `${ACC.btn} ${ACC.btnHover}`)}
                  onClick={()=> setChecked(true)}
                >
                  {match ? "Correct!" : "Check"}
                </button>
                {checked && (
                  <div className={clsx("text-sm font-medium", match?"text-emerald-700":"text-rose-700")}>
                    {match ? "Your boundary and comparator match the target." : "Not yet—tweak the boundary or comparator."}
                  </div>
                )}
                <button
                  className={clsx(
                    "px-4 py-2 rounded-xl font-semibold",
                    match ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-600 cursor-not-allowed"
                  )}
                  onClick={()=> match && onContinue()}
                  aria-disabled={!match}
                >
                  {idx < EX_LEVELS.length - 1 ? "Continue to next" : "Finish walkthrough"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <NeonPlane
          domain={L.domain}
          ineq={player}
          p1={p1} p2={p2} setP1={setP1} setP2={setP2}
          ACC={ACC}
          axisLabels={{ x: L.scen.xLabel, y: L.scen.yLabel }}
        />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <LegendPanel L={L} ACC={ACC} />
      </div>
    </div>
  );
}

// -------------------- Open Play: place valid plans by clicking integer points --------------------

function OpenPlayView({ L, ACC, p1, p2, setP1, setP2, comp, setComp, onCleared, onUpdateBest }: {
  L: ExampleLevel; ACC: ReturnType<typeof accentClasses>;
  p1:Pt; p2:Pt; setP1:(p:Pt)=>void; setP2:(p:Pt)=>void;
  comp:Comparator; setComp:(c:Comparator)=>void;
  onCleared?: ()=>void; onUpdateBest?: (acc:number)=>void;
}) {
  const [, setPoints] = useState<Pt[]>([]);
  const [score, setScore] = useState({ ok:0,total:0 });

  const ineq = { ...lineFromPoints(p1,p2), comp } as Inequality;

  const goal = 10; // place 10 valid plans
  const achievedPct = score.total ? Math.round(100*score.ok/score.total) : 0;
  const done = score.ok >= goal;

  useEffect(()=>{ onUpdateBest?.(achievedPct); if(done) onCleared?.(); }, [achievedPct, done, onCleared, onUpdateBest]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className={clsx("bg-white/90 rounded-2xl shadow p-4 flex items-center justify-between", ACC.border, "border") }>
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Open Play</div>
            <div className="text-lg font-medium">Place {goal} valid plans by clicking integer points inside the green region.</div>
            <div className="text-slate-600 text-sm">Current rule: <span className="font-mono">{ineqText(ineq)}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Comparator</label>
            <ComparatorToggle value={comp} onChange={setComp} />
          </div>
        </div>

        <NeonPlane
          domain={L.domain}
          ineq={ineq}
          p1={p1} p2={p2} setP1={setP1} setP2={setP2}
          ACC={ACC}
          placeMode
          axisLabels={{ x: L.scen.xLabel, y: L.scen.yLabel }}
          onPlace={(pt)=>{
            const inside = insideHalfPlane(pt.x, pt.y, ineq);
            setPoints(ps=> [...ps, pt]);
            setScore(s=> ({ ok: s.ok + (inside?1:0), total: s.total + 1 }));
          }}
        />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <div className={clsx("bg-white/90 rounded-2xl shadow p-4", ACC.border, "border") }>
          <div className="text-sm uppercase tracking-wide text-slate-500">Progress</div>
          <div className="text-2xl font-bold">{score.ok} / {goal} valid</div>
          <div className="text-slate-600 text-sm">Total placed: {score.total} · Accuracy: {achievedPct}%</div>
          {done && <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-sm">Cleared!</div>}
          <button className={clsx("mt-3 px-3 py-1.5 rounded-xl text-white", ACC.btn, ACC.btnHover)} onClick={()=> { setPoints([]); setScore({ok:0,total:0}); }}>
            <RotateCcw className="w-4 h-4 inline-block mr-1"/> Reset
          </button>
        </div>

        <LegendPanel L={L} ACC={ACC} />
      </div>
    </div>
  );
}

// -------------------- Scenario plan tester --------------------

function PlanTester({ L, player, ACC }: { L: ExampleLevel; player: Inequality; ACC: ReturnType<typeof accentClasses> }) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const TargetOK = insideHalfPlane(x,y,L.target);
  const YoursOK  = insideHalfPlane(x,y,player);
  const { XIcon, YIcon } = L.scen;

  return (
    <div className={clsx("rounded-2xl p-3 border bg-white/80", ACC.border)}>
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-1">Test a concrete plan</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <Counter label={L.scen.xLabel} Icon={XIcon} value={x} onChange={(v)=> setX(clamp(v, L.domain.xmin, L.domain.xmax))} />
        <Counter label={L.scen.yLabel} Icon={YIcon} value={y} onChange={(v)=> setY(clamp(v, L.domain.ymin, L.domain.ymax))} />
      </div>
      <div className="mt-2 font-mono text-sm">
        a·x + b·y {player.comp} c → {toFixed1(player.a)}·{x} + {toFixed1(player.b)}·{y} {player.comp} {toFixed1(player.c)}
      </div>
      <div className="mt-2 flex gap-3 text-sm">
        <Status tag="Target" ok={TargetOK} />
        <Status tag="Your rule" ok={YoursOK} />
      </div>
    </div>
  );
}

function Counter({ label, Icon, value, onChange }: { label: string; Icon: React.FC<any>; value: number; onChange: (v:number)=>void }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-slate-600"/>
      <span className="text-sm w-24 text-slate-700">{label}</span>
      <div className="inline-flex items-center rounded-xl border border-slate-200 overflow-hidden">
        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200" onClick={()=> onChange(value - 1)}>-</button>
        <input type="number" value={value} onChange={(e)=> onChange(parseFloat(e.target.value || "0"))} className="w-16 text-center outline-none" />
        <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200" onClick={()=> onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function Status({ tag, ok }: { tag: string; ok: boolean }) {
  return (
    <div className={clsx("px-2 py-1 rounded-lg text-xs font-semibold", ok?"bg-emerald-100 text-emerald-700":"bg-rose-100 text-rose-700")}>{tag}: {ok?"Accept":"Reject"}</div>
  );
}

// -------------------- Neon Plane (SVG) --------------------

function NeonPlane({
  domain, ineq, p1, p2, setP1, setP2, ACC, placeMode=false, onPlace,
  axisLabels
}: {
  domain:Domain2D; ineq:Inequality; p1:Pt; p2:Pt; setP1:(p:Pt)=>void; setP2:(p:Pt)=>void; ACC: ReturnType<typeof accentClasses>;
  placeMode?: boolean; onPlace?: (pt:Pt)=>void;
  axisLabels?: { x: string; y: string }; // NEW
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(()=>{ const ro=new ResizeObserver(()=> setSize({ w: ref.current?.clientWidth ?? 0, h: ref.current?.clientHeight ?? 0 })); if(ref.current) ro.observe(ref.current); return ()=> ro.disconnect(); },[]);

  const pad = 40; const W = Math.max(300, size.w), H = Math.max(260, size.h);
  const sx = (x:number)=> pad + ((x-domain.xmin)/(domain.xmax-domain.xmin))*(W-2*pad);
  const sy = (y:number)=> H - pad - ((y-domain.ymin)/(domain.ymax-domain.ymin))*(H-2*pad);
  const ux = (px:number)=> domain.xmin + ((px - pad)/(W-2*pad))*(domain.xmax-domain.xmin);
  const uy = (py:number)=> domain.ymin + (((H - pad) - py)/(H-2*pad))*(domain.ymax-domain.ymin);

  const poly = clipRectByHalfPlane(domain, ineq);
  const polyPath = poly.map((p,i)=> `${i===0?"M":"L"}${sx(p.x)},${sy(p.y)}`).join(" ") + (poly.length?" Z":"");

  const boundary = boundarySegment(domain, { a: ineq.a, b: ineq.b, c: ineq.c });

  const [drag, setDrag] = useState<null|"A"|"B">(null);
  function onMove(e: React.MouseEvent){ if(!drag) return; const rect=(e.currentTarget as HTMLDivElement).getBoundingClientRect(); const x=ux(e.clientX-rect.left), y=uy(e.clientY-rect.top); const q={ x: clamp(x,domain.xmin,domain.xmax), y: clamp(y,domain.ymin,domain.ymax) }; if(drag==="A") setP1(q); else setP2(q); }

  function onClick(e: React.MouseEvent){ if(!placeMode || !onPlace) return; const rect=(e.currentTarget as HTMLDivElement).getBoundingClientRect(); const x=ux(e.clientX-rect.left), y=uy(e.clientY-rect.top); const gx=Math.round(x), gy=Math.round(y); if(gx<domain.xmin||gx>domain.xmax||gy<domain.ymin||gy>domain.ymax) return; onPlace({ x: gx, y: gy }); }

  return (
    <div className={clsx("rounded-2xl shadow overflow-hidden border", ACC.border)} ref={ref}>
      <div className="relative" onMouseMove={onMove} onMouseUp={()=> setDrag(null)} onMouseLeave={()=> setDrag(null)} onClick={onClick}>
        <svg width={W} height={H} className="block bg-night">
          <defs>
            <linearGradient id="gp" x1="0" x2="1">
              <stop offset="0%" stopColor={ACC.glowA}/>
              <stop offset="100%" stopColor={ACC.glowB}/>
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff10" strokeWidth="1"/>
            </pattern>
          </defs>

          <rect x={0} y={0} width={W} height={H} fill="url(#grid)" />

          {/* axes (0-lines) */}
          <line x1={sx(domain.xmin)} y1={sy(0)} x2={sx(domain.xmax)} y2={sy(0)} stroke="#ffffff55" strokeWidth={1} />
          <line x1={sx(0)} y1={sy(domain.ymin)} x2={sx(0)} y2={sy(domain.ymax)} stroke="#ffffff55" strokeWidth={1} />

          {/* integer ticks & labels on axes */}
          {Array.from({ length: domain.xmax - domain.xmin + 1 }).map((_, i) => {
            const x = domain.xmin + i;
            if (x % (domain.step*2) !== 0) return null;
            return (
              <g key={`xtick-${x}`}>
                <line x1={sx(x)} y1={sy(0)-4} x2={sx(x)} y2={sy(0)+4} stroke="#ffffff66" strokeWidth={1}/>
                <text x={sx(x)} y={sy(0)+14} fontSize={10} fill="#cbd5e1" textAnchor="middle">{x}</text>
              </g>
            );
          })}
          {Array.from({ length: domain.ymax - domain.ymin + 1 }).map((_, j) => {
            const y = domain.ymin + j;
            if (y % (domain.step*2) !== 0) return null;
            return (
              <g key={`ytick-${y}`}>
                <line x1={sx(0)-4} y1={sy(y)} x2={sx(0)+4} y2={sy(y)} stroke="#ffffff66" strokeWidth={1}/>
                <text x={sx(0)-8} y={sy(y)+3} fontSize={10} fill="#cbd5e1" textAnchor="end">{y}</text>
              </g>
            );
          })}

          {/* axis titles (scenario labels) */}
          {axisLabels && (
            <>
              {/* x title */}
              <text x={sx(domain.xmax)} y={sy(0)+28} fontSize={12} fill="#a7f3d0" textAnchor="end">
                {axisLabels.x} (x)
              </text>
              {/* y title (rotated) */}
              <g transform={`translate(${sx(0)-28}, ${sy(domain.ymax)}) rotate(-90)`}>
                <text fontSize={12} fill="#a7f3d0" textAnchor="end">{axisLabels.y} (y)</text>
              </g>
            </>
          )}

          {/* feasible shade */}
          {poly.length>=3 && <path d={polyPath} fill="#10b98133" stroke="none"/>}

          {/* grid dots for integer lattice (in place mode) */}
          {placeMode && (
            <g>
              {Array.from({ length: (domain.xmax-domain.xmin+1)*(domain.ymax-domain.ymin+1) }).map((_,k)=>{
                const i = k % (domain.xmax-domain.xmin+1);
                const j = Math.floor(k / (domain.xmax-domain.xmin+1));
                const x = domain.xmin + i; const y = domain.ymin + j;
                return <circle key={k} cx={sx(x)} cy={sy(y)} r={1.5} fill="#ffffff33"/>;
              })}
            </g>
          )}

          {/* boundary line */}
          {boundary && (
            <g filter="url(#glow)">
              <line x1={sx(boundary.p.x)} y1={sy(boundary.p.y)} x2={sx(boundary.q.x)} y2={sy(boundary.q.y)} stroke="url(#gp)" strokeWidth={3}/>
              <circle cx={sx(boundary.p.x)} cy={sy(boundary.p.y)} r={6} fill={ineq.comp==="<"||ineq.comp===">"?"#0f172a":"#0ea5e9"} stroke={ACC.glowB} strokeWidth={2}/>
              <circle cx={sx(boundary.q.x)} cy={sy(boundary.q.y)} r={6} fill={ineq.comp==="<"||ineq.comp===">"?"#0f172a":"#0ea5e9"} stroke={ACC.glowB} strokeWidth={2}/>
            </g>
          )}

          {/* draggable handles */}
          <g>
            <Dragger cx={sx(p1.x)} cy={sy(p1.y)} label="A" onDown={()=> setDrag("A")} />
            <Dragger cx={sx(p2.x)} cy={sy(p2.y)} label="B" onDown={()=> setDrag("B")} />
          </g>
        </svg>

        {/* current inequality */}
        <div className="absolute bottom-3 left-3 bg-slate-900/70 backdrop-blur rounded-xl border px-3 py-1 text-emerald-200 font-mono text-sm" style={{ borderColor: ACC.glowB }}>
          {ineqText(ineq)}
        </div>
      </div>
    </div>
  );
}

function boundarySegment(dom:Domain2D, line:{a:number;b:number;c:number}){
  const edges=[
    {p:{x:dom.xmin,y:dom.ymin},q:{x:dom.xmin,y:dom.ymax}},
    {p:{x:dom.xmax,y:dom.ymin},q:{x:dom.xmax,y:dom.ymax}},
    {p:{x:dom.xmin,y:dom.ymin},q:{x:dom.xmax,y:dom.ymin}},
    {p:{x:dom.xmin,y:dom.ymax},q:{x:dom.xmax,y:dom.ymax}},
  ];
  const pts:Pt[]=[];
  edges.forEach(({p,q})=>{ const dx=q.x-p.x, dy=q.y-p.y; const den=line.a*dx+line.b*dy; if(Math.abs(den)<1e-9) return; const t=(line.c-(line.a*p.x+line.b*p.y))/den; if(t>=-1e-6&&t<=1+1e-6){ const X={x:p.x+t*dx,y:p.y+t*dy}; if(X.x>=dom.xmin-1e-6 && X.x<=dom.xmax+1e-6 && X.y>=dom.ymin-1e-6 && X.y<=dom.ymax+1e-6) pts.push(X);} });
  if(pts.length<2) return null; let best:[Pt,Pt]=[pts[0],pts[1]],d=0; for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){ const dd=Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y); if(dd>d){ d=dd; best=[pts[i],pts[j]]; } } return {p:best[0],q:best[1]};
}

function Dragger({ cx, cy, label, onDown }: { cx:number; cy:number; label:string; onDown:()=>void }){
  return (
    <g onMouseDown={onDown} style={{ cursor: "grab" }}>
      <circle cx={cx} cy={cy} r={8} fill="#0ea5e9" stroke="#22d3ee" strokeWidth={2} />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} fill="#e879f9">{label}</text>
    </g>
  );
}

// -------------------- Small UI bits --------------------

function LevelHeader({ idx, setIdx, total, L, ACC }: { idx:number; setIdx:(i:number)=>void; total:number; L:ExampleLevel; ACC:ReturnType<typeof accentClasses> }){
  return (
    <div className={clsx("rounded-2xl shadow p-4 flex items-center justify-between bg-white/90", ACC.border, "border")}>
      <div className="flex items-center gap-3">
        <div className={clsx("rounded-full w-10 h-10 grid place-items-center font-bold", L.scen.accent==="amber"?"bg-amber-100 text-amber-700": L.scen.accent==="cyan"?"bg-cyan-100 text-cyan-700": L.scen.accent==="emerald"?"bg-emerald-100 text-emerald-700": L.scen.accent==="fuchsia"?"bg-fuchsia-100 text-fuchsia-700":"bg-rose-100 text-rose-700")}>{L.id}</div>
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-500">Example</div>
          <div className="text-lg font-semibold">{L.title}</div>
          <div className="text-slate-600 text-sm">{L.description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={()=> setIdx(Math.max(0, idx-1))} aria-label="Previous"><ChevronLeft className="w-5 h-5"/></button>
        <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={()=> setIdx(Math.min(total-1, idx+1))} aria-label="Next"><ChevronRight className="w-5 h-5"/></button>
      </div>
    </div>
  );
}

function LegendPanel({ L, ACC }: { L:ExampleLevel; ACC: ReturnType<typeof accentClasses> }){
  const { xLabel, yLabel } = L.scen;
  return (
    <div className={clsx("bg-white/90 rounded-2xl shadow p-4", ACC.border, "border") }>
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Legend</div>
      <ul className="space-y-1 text-sm text-slate-700">
        <li>• Boundary line: <span className="font-mono">ax + by = c</span>.</li>
        <li>• Green shade obeys <span className="font-mono">ax + by {L.target.comp} c</span>.</li>
        <li>• "&le;"/"&lt;" vs "&ge;"/"&gt;" choose which side is shaded (strict is hollow caps).</li>
        <li>• x-axis: {xLabel}. y-axis: {yLabel}.</li>
      </ul>
    </div>
  );
}

function ComparatorToggle({ value, onChange }: { value: Comparator; onChange: (c: Comparator) => void }){
  const opts: Comparator[] = ["<=","<",">=",">"];
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
      {opts.map(c=> (
        <button key={c} onClick={()=> onChange(c)} className={clsx("px-3 py-1.5 text-sm font-mono", value===c?"bg-slate-900 text-white":"bg-white text-slate-700 hover:bg-slate-100")}>{c}</button>
      ))}
    </div>
  );
}

function ineqText(ineq:Inequality){ return `${toFixed1(ineq.a)}x + ${toFixed1(ineq.b)}y ${ineq.comp} ${toFixed1(ineq.c)}`; }

function ConfettiOverlay({ label, colorA, colorB }: { label:string; colorA:string; colorB:string }){
  const pieces = Array.from({ length: 80 }).map(()=> ({ id: Math.random().toString(36).slice(2), x: Math.random()*100, d: 30 + Math.random()*60, r: Math.random()*360 }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map(p=> (
        <motion.div key={p.id} initial={{ x: `${p.x}vw`, y: -40, rotate: p.r, opacity: 0 }} animate={{ x: `${p.x + (Math.random()*20-10)}vw`, y: `${p.d}vh`, rotate: p.r + 180, opacity: 1 }} transition={{ duration: 1.2 + Math.random()*0.8, ease: "easeOut" }} className="w-2 h-3 rounded-sm" style={{ background: `linear-gradient(${colorA}, ${colorB})` }} />
      ))}
      <div className="absolute inset-x-0 top-10 flex justify-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 shadow text-slate-800 font-semibold"><Sparkles className="w-5 h-5"/> {label}</span>
      </div>
    </div>
  );
}

// -------------------- Index.css helpers (optional) --------------------
/*
Add to src/index.css for the background vibe:
.neon-bg { background: radial-gradient(1200px 600px at 10% -10%, #ff80bf20, transparent),
                        radial-gradient(1000px 500px at 90% 10%, #80e9ff20, transparent),
                        linear-gradient(#0b1220, #0b1220); }
.bg-night { background: linear-gradient(180deg, #0f172a, #0b1220); }
*/
