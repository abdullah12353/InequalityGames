/*
Feasible Zone — Game 5 of the Inequalities Campaign
Theme: Night Market Permits — build inside the LEGAL ZONE (intersection of rules)
Age band: 10–15 | 2D | React + Tailwind v4 + Framer Motion

Focus
- Systems of linear inequalities → convex polygon (feasible zone)
- "Binding" (active) vs "Slack" constraints at a chosen plan point
- Vertex coordinates shown on hover
- Start with Examples (2→3→4 constraints), then Open Play with goals
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Move, Ruler, Shield, Volume2, Wallet, RotateCcw } from "lucide-react";
import clsx from "clsx";

// -------------------- Types --------------------

type Comparator = "<=" | "<" | ">=" | ">";
export type Constraint = { id: string; a: number; b: number; c: number; comp: Comparator; label: string; color: string };

type Domain2D = { xmin: number; xmax: number; ymin: number; ymax: number };

type Pt = { x: number; y: number };

// -------------------- Math utils --------------------

const round1 = (x:number)=> Math.abs(x%1)<1e-6 ? x.toString() : x.toFixed(1);

function insideHalfPlane(p: Pt, k: Constraint) {
  const s = k.a * p.x + k.b * p.y;
  switch (k.comp) {
    case "<=": return s <= k.c + 1e-9;
    case "<": return s < k.c - 1e-9;
    case ">=": return s >= k.c - 1e-9;
    case ">": return s > k.c + 1e-9;
  }
}

function intersectLineSegWithLine(p: Pt, q: Pt, k: Constraint): Pt {
  const dx = q.x - p.x, dy = q.y - p.y;
  const den = k.a * dx + k.b * dy;
  if (Math.abs(den) < 1e-12) return q; // parallel fallback
  const t = (k.c - (k.a * p.x + k.b * p.y)) / den;
  return { x: p.x + t * dx, y: p.y + t * dy };
}

function clipPolyByHalfPlane(poly: Pt[], k: Constraint): Pt[] {
  if (poly.length === 0) return [];
  const out: Pt[] = [];
  let S = poly[poly.length - 1];
  const S_in = insideHalfPlane(S, k);
  for (const E of poly) {
    const E_in = insideHalfPlane(E, k);
    if (E_in) {
      if (!S_in) out.push(intersectLineSegWithLine(S, E, k));
      out.push(E);
    } else if (S_in) {
      out.push(intersectLineSegWithLine(S, E, k));
    }
    S = E;
  }
  // tiny cleanup (merge almost-equal consecutive points)
  const cleaned: Pt[] = [];
  for (const p of out) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-6) cleaned.push(p);
  }
  return cleaned;
}

function initRect(dom: Domain2D): Pt[] {
  return [
    { x: dom.xmin, y: dom.ymin },
    { x: dom.xmax, y: dom.ymin },
    { x: dom.xmax, y: dom.ymax },
    { x: dom.xmin, y: dom.ymax },
  ];
}

function feasiblePolygon(dom: Domain2D, constraints: Constraint[]): Pt[] {
  let poly = initRect(dom);
  for (const k of constraints) poly = clipPolyByHalfPlane(poly, k);
  return poly;
}

function polygonArea(poly: Pt[]) {
  if (poly.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    s += a.x * b.y - a.y * b.x;
  }
  return Math.abs(s) / 2;
}

// compare two systems by testing a lattice of points
function systemsEquivalent(dom: Domain2D, A: Constraint[], B: Constraint[]) {
  const step = 0.5; // finer than 1 to catch strict edges
  for (let x = dom.xmin; x <= dom.xmax; x += step) {
    for (let y = dom.ymin; y <= dom.ymax; y += step) {
      const p = { x, y };
      const inA = A.every(k => insideHalfPlane(p, k));
      const inB = B.every(k => insideHalfPlane(p, k));
      if (inA !== inB) return false;
    }
  }
  return true;
}

// binding vs slack at a point
function bindingStatus(p: Pt, k: Constraint): "binding" | "slack" | "violated" {
  const s = k.a * p.x + k.b * p.y - k.c;
  const tol = 1e-2;
  const inside = insideHalfPlane(p, k);
  if (!inside) return "violated";
  if (Math.abs(s) <= tol) return "binding";
  return "slack";
}

// -------------------- Levels --------------------

type Level = {
  id: number; title: string; description: string; dom: Domain2D; target: Constraint[];
};

const LEVELS: Level[] = [
  {
    id: 1,
    title: "Two Rules: Budget & Security",
    description: "Stay under budget and keep the security line to the right.",
    dom: { xmin: 0, xmax: 12, ymin: 0, ymax: 12 },
    target: [
      { id: "budget", a: 2, b: 1, c: 12, comp: "<=", label: "Budget ≤", color: "amber" }, // 2x+y ≤ 12
      { id: "security", a: 1, b: 0, c: 2, comp: ">=", label: "Security ≥", color: "emerald" }, // x ≥ 2
    ],
  },
  {
    id: 2,
    title: "Add Noise Control",
    description: "Budget, security, and keep noise under control.",
    dom: { xmin: 0, xmax: 14, ymin: 0, ymax: 14 },
    target: [
      { id: "budget", a: 1, b: 2, c: 14, comp: "<=", label: "Budget ≤", color: "amber" },
      { id: "security", a: 1, b: 0, c: 1, comp: ">=", label: "Security ≥", color: "emerald" },
      { id: "noise", a: 0, b: 1, c: 1, comp: ">=", label: "Noise min ≥", color: "fuchsia" }, // y ≥ 1
    ],
  },
  {
    id: 3,
    title: "Four Rules: Budget, Noise, Security, Walkway",
    description: "Combine four city rules to get the legal build zone.",
    dom: { xmin: 0, xmax: 12, ymin: 0, ymax: 12 },
    target: [
      { id: "budget", a: 3, b: 2, c: 18, comp: "<=", label: "Budget ≤", color: "amber" },
      { id: "noise", a: 0, b: 1, c: 7, comp: "<=", label: "Noise ≤", color: "fuchsia" },
      { id: "security", a: 1, b: 0, c: 2, comp: ">=", label: "Security ≥", color: "emerald" },
      { id: "walkway", a: 1, b: 1, c: 6, comp: ">=", label: "Walkway ≥", color: "cyan" },
    ],
  },
];

// -------------------- Component --------------------

export default function FeasibleZone({ onCleared, onUpdateBest }: { onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  const [mode, setMode] = useState<"examples" | "open">("examples");
  const [idx, setIdx] = useState(0);
  const L = LEVELS[idx];

  // Player constraints start as a noisy copy (students must adjust)
  const [player, setPlayer] = useState<Constraint[]>(() => tweak(L.target));
  useEffect(() => { setPlayer(tweak(LEVELS[idx].target)); setPicked(undefined); setChecked(false); }, [idx]);

  const [checked, setChecked] = useState(false);
  const [matched, setMatched] = useState(false);

  const dom = L.dom;
  const polyTarget = useMemo(() => feasiblePolygon(dom, L.target), [dom, L]);
  const polyPlayer = useMemo(() => feasiblePolygon(dom, player), [dom, player]);
  const areaPlayer = useMemo(() => polygonArea(polyPlayer), [polyPlayer]);

  useEffect(() => {
    if (!checked) return;
    const same = systemsEquivalent(dom, L.target, player);
    setMatched(same);
    if (same) { onCleared?.(); onUpdateBest?.(100); }
  }, [checked, dom, L, player, onCleared, onUpdateBest]);

  // binding/slack tester: place a plan point by clicking the canvas
  const [picked, setPicked] = useState<Pt | undefined>(undefined);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-6">
        <Header mode={mode} setMode={setMode} L={L} />

        {mode === "examples" ? (
          <ExamplesView
            dom={dom}
            target={L.target}
            player={player}
            setPlayer={setPlayer}
            polyTarget={polyTarget}
            polyPlayer={polyPlayer}
            areaPlayer={areaPlayer}
            idx={idx}
            setIdx={setIdx}
            checked={checked}
            setChecked={setChecked}
            matched={matched}
            picked={picked}
            setPicked={setPicked}
          />
        ) : (
          <OpenPlay
            dom={{ xmin: 0, xmax: 18, ymin: 0, ymax: 18 }}
            onCleared={onCleared}
            onUpdateBest={onUpdateBest}
          />
        )}
      </div>
    </div>
  );
}

function Header({ mode, setMode, L }: { mode: "examples" | "open"; setMode: (m: "examples" | "open") => void; L: Level }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow p-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Feasible Zone</h1>
        <p className="text-slate-600 text-sm">Intersection of rules → legal build polygon. Level {L.id}: {L.title}</p>
      </div>
      <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
        <button onClick={() => setMode("examples")} className={clsx("px-3 py-2 text-sm", mode === "examples" ? "bg-indigo-600 text-white" : "bg-white text-slate-700")}>Examples</button>
        <button onClick={() => setMode("open")} className={clsx("px-3 py-2 text-sm", mode === "open" ? "bg-indigo-600 text-white" : "bg-white text-slate-700")}>Open Play</button>
      </div>
    </div>
  );
}

// -------------------- Examples --------------------

function ExamplesView(props: {
  dom: Domain2D; target: Constraint[]; player: Constraint[]; setPlayer: (c: Constraint[]) => void;
  polyTarget: Pt[]; polyPlayer: Pt[]; areaPlayer: number;
  idx: number; setIdx: (i: number) => void; checked: boolean; setChecked: (b: boolean) => void; matched: boolean;
  picked?: Pt; setPicked: (p?: Pt) => void;
}) {
  const { dom, target, player, setPlayer, polyPlayer, areaPlayer, idx, setIdx, checked, setChecked, matched, picked, setPicked } = props;

  // Update a single constraint (by id)
  function update(id: string, patch: Partial<Constraint>) {
    setPlayer(player.map(k => (k.id === id ? { ...k, ...patch } : k)));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl shadow p-4 border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Example</div>
            <div className="text-lg font-semibold">{LEVELS[idx].title}</div>
            <div className="text-slate-600 text-sm">{LEVELS[idx].description}</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setIdx(Math.max(0, idx - 1))}>Prev</button>
            <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setIdx(Math.min(LEVELS.length - 1, idx + 1))}>Next</button>
          </div>
        </div>

        <ConstraintPanel player={player} update={update} />

        <Board
          dom={dom}
          constraints={player}
          polygon={polyPlayer}
          onPick={(p) => setPicked(p)}
          picked={picked}
          showVertices
        />

        <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
          <div className="text-sm uppercase tracking-wide text-slate-500 mb-1">Binding vs Slack at your plan</div>
          {picked ? (
            <BindingList p={picked} constraints={player} />
          ) : (
            <div className="text-slate-600 text-sm">Click inside the board to place a plan point. Binding edges will be highlighted.</div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button className={clsx("px-4 py-2 rounded-xl text-white", matched ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700")} onClick={() => setChecked(true)}>
            {matched ? "Perfect Match!" : "Check"}
          </button>
          {checked && (
            <div className={clsx("text-sm font-medium", matched ? "text-emerald-700" : "text-rose-700")}>{matched ? "Your legal zone matches the target system." : "Not matching yet—adjust rules until the polygon matches."}</div>
          )}
          <div className="ml-auto text-sm text-slate-600">Polygon area: <span className="font-mono">{round1(areaPlayer)}</span></div>
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
          <div className="text-sm uppercase tracking-wide text-slate-500 mb-1">Target vs Yours</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-slate-500 mb-1">Target polygon</div>
              <MiniBoard dom={dom} constraints={target} />
            </div>
            <div>
              <div className="text-slate-500 mb-1">Your polygon</div>
              <MiniBoard dom={dom} constraints={player} />
            </div>
          </div>
        </div>
        <Legend />
      </div>
    </div>
  );
}

function MiniBoard({ dom, constraints }: { dom: Domain2D; constraints: Constraint[] }) {
    const poly = useMemo(() => feasiblePolygon(dom, constraints), [dom, constraints]);
    return <Board dom={dom} constraints={constraints} polygon={poly} />;
}

function ConstraintPanel({ player, update }: { player: Constraint[]; update: (id: string, patch: Partial<Constraint>) => void }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-3">Rules (adjust to match the target zone)</div>
      <div className="grid sm:grid-cols-2 gap-3">
        {player.map((k) => (
          <div key={k.id} className="rounded-xl border p-3" style={{ borderColor: colorBorder(k.color) }}>
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2"><RuleIcon label={k.label} color={k.color} /> {k.label}</div>
              <ComparatorToggle value={k.comp} onChange={(c) => update(k.id, { comp: c })} />
            </div>
            <div className="mt-2 text-xs text-slate-600">Equation: <span className="font-mono">{`${round1(k.a)}x + ${round1(k.b)}y ${k.comp} ${round1(k.c)}`}</span></div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-600 w-24">Move line (c)</span>
              <input type="range" min={-2} max={24} step={0.5} value={k.c} onChange={(e) => update(k.id, { c: parseFloat(e.target.value) })} className="flex-1" />
              <span className="font-mono text-sm w-10 text-right">{round1(k.c)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BindingList({ p, constraints }: { p: Pt; constraints: Constraint[] }) {
  return (
    <div className="space-y-2">
      {constraints.map((k) => {
        const s = bindingStatus(p, k);
        return (
          <div key={k.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2"><RuleIcon label={k.label} color={k.color} /><span className="font-mono">{`${round1(k.a)}x + ${round1(k.b)}y ${k.comp} ${round1(k.c)}`}</span></div>
            <span className={clsx("px-2 py-0.5 rounded-lg text-xs font-semibold", s === "binding" ? "bg-amber-100 text-amber-700" : s === "slack" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>{s}</span>
          </div>
        );
      })}
      <div className="text-xs text-slate-500">Binding ≈ on the edge (equality); Slack = strictly inside.</div>
    </div>
  );
}

// -------------------- Open Play --------------------

function OpenPlay({ dom, onCleared, onUpdateBest }: { dom: Domain2D; onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  // Template constraints player can enable/tune
  const [rules, setRules] = useState<Constraint[]>([
    { id: "budget", a: 2, b: 1, c: 16, comp: "<=", label: "Budget ≤", color: "amber" },
    { id: "noise", a: 0, b: 1, c: 12, comp: "<=", label: "Noise ≤", color: "fuchsia" },
    { id: "security", a: 1, b: 0, c: 3, comp: ">=", label: "Security ≥", color: "emerald" },
    { id: "walkway", a: 1, b: 1, c: 10, comp: ">=", label: "Walkway ≥", color: "cyan" },
  ]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ budget: true, noise: true, security: true, walkway: false });

  // Target marker kids must include inside the feasible zone
  const [target, setTarget] = useState<Pt>(() => ({ x: 8 + Math.random() * 6 - 3, y: 8 + Math.random() * 6 - 3 }));
  const [plan, setPlan] = useState<Pt | undefined>(undefined);

  const active = rules.filter(r => enabled[r.id]);
  const poly = useMemo(() => feasiblePolygon(dom, active), [dom, active]);
  const area = useMemo(() => polygonArea(poly), [poly]);
  const verts = poly.length;

  // Goals
  const goals = {
    nonempty: poly.length >= 3,
    includesTarget: target ? insideAll(target, active) : false,
    vertexCount: verts >= 4,
  };
  const done = goals.nonempty && goals.includesTarget && goals.vertexCount;
  const acc = Math.round(100 * ([goals.nonempty, goals.includesTarget, goals.vertexCount].filter(Boolean).length / 3));

  useEffect(() => { onUpdateBest?.(acc); if (done) onCleared?.(); }, [acc, done, onCleared, onUpdateBest]);

  function updateRule(id: string, patch: Partial<Constraint>) {
    setRules(rules.map(k => (k.id === id ? { ...k, ...patch } : k)));
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-2xl shadow p-4 border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Open Play</div>
            <div className="text-lg font-semibold">Shape the legal zone. Complete the 3 permit goals.</div>
            <div className="text-slate-600 text-sm">Accuracy = goals completed (non-empty, include star, ≥4 vertices).</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{acc}%</div>
            <div className={clsx("text-xs inline-block mt-1 px-2 py-0.5 rounded-lg", done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700")}>{done ? "Cleared" : "Work in progress"}</div>
          </div>
        </div>

        <Board
          dom={dom}
          constraints={active}
          polygon={poly}
          picked={plan}
          onPick={(p) => setPlan(p)}
          showVertices
          target={target}
          onMoveTarget={() => setTarget({ x: 4 + Math.random() * 10, y: 4 + Math.random() * 10 })}
        />

        <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
          <div className="text-sm uppercase tracking-wide text-slate-500">Permit goals</div>
          <ul className="mt-2 space-y-1 text-sm">
            <GoalItem ok={goals.nonempty} text="Legal zone is non-empty (polygon exists)" />
            <GoalItem ok={goals.includesTarget} text="Star point is inside the legal zone" />
            <GoalItem ok={goals.vertexCount} text="Legal zone has at least 4 vertices" />
          </ul>
          <div className="mt-2 text-sm text-slate-600">Area: <span className="font-mono">{round1(area)}</span> · Vertices: <span className="font-mono">{verts}</span></div>
          <button className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => { setPlan(undefined); setTarget({ x: 4 + Math.random() * 10, y: 4 + Math.random() * 10 }); }}>New star</button>
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
          <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Active rules</div>
          {rules.map((k) => (
            <div key={k.id} className="mb-3 rounded-xl border p-3" style={{ borderColor: colorBorder(k.color) }}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!enabled[k.id]} onChange={(e) => setEnabled({ ...enabled, [k.id]: e.target.checked })} className="mr-1" />
                  <RuleIcon label={k.label} color={k.color} />
                  <span className="text-sm font-medium">{k.label}</span>
                </label>
                <ComparatorToggle value={k.comp} onChange={(c) => updateRule(k.id, { comp: c })} />
              </div>
              <div className="mt-2 text-xs text-slate-600">{`${round1(k.a)}x + ${round1(k.b)}y ${k.comp} ${round1(k.c)}`}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-600 w-24">Move line (c)</span>
                <input type="range" min={-2} max={24} step={0.5} value={k.c} onChange={(e) => updateRule(k.id, { c: parseFloat(e.target.value) })} className="flex-1" />
                <span className="font-mono text-sm w-10 text-right">{round1(k.c)}</span>
              </div>
            </div>
          ))}
          <button className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => setRules(shuffleCoeffs(rules))}><Ruler className="w-4 h-4 inline mr-1"/> Randomize slopes</button>
          <button className="ml-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={() => { setRules(defaultOpenRules()); setEnabled({ budget: true, noise: true, security: true, walkway: false }); }}><RotateCcw className="w-4 h-4 inline mr-1"/> Reset</button>
        </div>
        <Legend />
      </div>
    </div>
  );
}

function defaultOpenRules(): Constraint[] {
  return [
    { id: "budget", a: 2, b: 1, c: 16, comp: "<=", label: "Budget ≤", color: "amber" },
    { id: "noise", a: 0, b: 1, c: 12, comp: "<=", label: "Noise ≤", color: "fuchsia" },
    { id: "security", a: 1, b: 0, c: 3, comp: ">=", label: "Security ≥", color: "emerald" },
    { id: "walkway", a: 1, b: 1, c: 10, comp: ">=", label: "Walkway ≥", color: "cyan" },
  ];
}

function shuffleCoeffs(rules: Constraint[]): Constraint[] {
  return rules.map(r => ({ ...r, a: Math.max(-3, Math.min(3, r.a + (Math.random() < 0.5 ? -1 : 1))), b: Math.max(-3, Math.min(3, r.b + (Math.random() < 0.5 ? -1 : 1))) }));
}

function insideAll(p: Pt, rules: Constraint[]) {
  return rules.length > 0 && rules.every(k => insideHalfPlane(p, k));
}

function GoalItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2"><span className={clsx("inline-flex items-center justify-center w-5 h-5 rounded-full", ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{ok ? <CheckCircle2 className="w-4 h-4"/> : <Circle className="w-3 h-3"/>}</span><span className={clsx(ok ? "text-slate-700" : "text-slate-600")}>{text}</span></li>
  );
}

// -------------------- Boards --------------------

function Board({ dom, constraints, polygon, onPick, picked, showVertices=false, target, onMoveTarget }: {
  dom: Domain2D; constraints: Constraint[]; polygon: Pt[]; onPick?: (p: Pt) => void; picked?: Pt; showVertices?: boolean; target?: Pt; onMoveTarget?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => { const ro = new ResizeObserver(() => setSize({ w: ref.current?.clientWidth ?? 0, h: ref.current?.clientHeight ?? 0 })); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }, []);

  const pad = 24; const W = Math.max(320, size.w), H = Math.max(300, size.h);
  const sx = (x:number)=> pad + ((x - dom.xmin)/(dom.xmax - dom.xmin)) * (W - 2*pad);
  const sy = (y:number)=> H - pad - ((y - dom.ymin)/(dom.ymax - dom.ymin)) * (H - 2*pad);
  const ux = (px:number)=> dom.xmin + ((px - pad)/(W - 2*pad)) * (dom.xmax - dom.xmin);
  const uy = (py:number)=> dom.ymin + (((H - pad) - py)/(H - 2*pad)) * (dom.ymax - dom.ymin);

  function onClick(e: React.MouseEvent) {
    if (!onPick) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = ux(e.clientX - rect.left); const y = uy(e.clientY - rect.top);
    onPick({ x: Math.round(x), y: Math.round(y) });
  }

  // Tooltip state
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);

  return (
    <div className="bg-night rounded-2xl shadow border border-slate-200 overflow-hidden" ref={ref}>
      <div className="relative" onClick={onClick}>
        <svg width={W} height={H} className="block">
          <defs>
            <linearGradient id="fp" x1="0" x2="1">
              <stop offset="0%" stopColor="#22d3ee"/>
              <stop offset="100%" stopColor="#34d399"/>
            </linearGradient>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#ffffff10" strokeWidth="1"/>
            </pattern>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* background grid */}
          <rect x={0} y={0} width={W} height={H} fill="url(#grid)" />

          {/* axes */}
          <line x1={sx(dom.xmin)} y1={sy(0)} x2={sx(dom.xmax)} y2={sy(0)} stroke="#ffffff55" strokeWidth={1} />
          <line x1={sx(0)} y1={sy(dom.ymin)} x2={sx(0)} y2={sy(dom.ymax)} stroke="#ffffff55" strokeWidth={1} />

          {/* draw each constraint boundary (for context) */}
          {constraints.map(k => {
            const seg = boundarySeg(dom, k);
            if (!seg) return null;
            const capFill = (k.comp === "<" || k.comp === ">") ? "#0b1220" : colorStroke(k.color);
            return (
              <g key={k.id} filter="url(#glow)">
                <line x1={sx(seg.p.x)} y1={sy(seg.p.y)} x2={sx(seg.q.x)} y2={sy(seg.q.y)} stroke={colorStroke(k.color)} strokeWidth={2.5} />
                <circle cx={sx(seg.p.x)} cy={sy(seg.p.y)} r={5} fill={capFill} stroke={colorStroke(k.color)} strokeWidth={2} />
                <circle cx={sx(seg.q.x)} cy={sy(seg.q.y)} r={5} fill={capFill} stroke={colorStroke(k.color)} strokeWidth={2} />
              </g>
            );
          })}

          {/* feasible polygon */}
          {polygon.length >= 3 && (
            <g>
              <path d={polyPath(polygon, sx, sy)} fill="#10b98133" stroke="url(#fp)" strokeWidth={2} />
              {showVertices && polygon.map((v, i) => (
                <g key={i}>
                  <circle cx={sx(v.x)} cy={sy(v.y)} r={4.5} fill="#0ea5e9" stroke="#a5f3fc" strokeWidth={1.5}
                    onMouseEnter={() => setTip({ x: sx(v.x), y: sy(v.y) - 12, label: `(${round1(v.x)}, ${round1(v.y)})` })}
                    onMouseLeave={() => setTip(null)}
                  />
                </g>
              ))}
            </g>
          )}

          {/* target star (open play) */}
          {target && (
            <g onClick={(e) => { e.stopPropagation(); onMoveTarget && onMoveTarget(); }}>
              <polygon points={`${sx(target.x)},${sy(target.y - 0.7)} ${sx(target.x + 0.35)},${sy(target.y + 0.5)} ${sx(target.x - 0.6)},${sy(target.y - 0.2)} ${sx(target.x + 0.6)},${sy(target.y - 0.2)} ${sx(target.x - 0.35)},${sy(target.y + 0.5)}`} fill="#fbbf24" stroke="#92400e" strokeWidth={1}/>
            </g>
          )}

          {/* picked plan point */}
          {picked && (
            <g>
              <circle cx={sx(picked.x)} cy={sy(picked.y)} r={5} fill="#22c55e" stroke="#064e3b" strokeWidth={2} />
            </g>
          )}
        </svg>

        {/* vertex tooltip */}
        <AnimatePresence>{tip && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="absolute px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg shadow" style={{ left: tip.x + 8, top: tip.y }}>
            {tip.label}
          </motion.div>
        )}</AnimatePresence>

        {/* help overlay */}
        <div className="absolute bottom-3 left-3 bg-slate-900/70 text-white text-xs px-2 py-1 rounded-lg">Click to place a plan (integer point). Hover vertices to see coordinates.</div>
      </div>
    </div>
  );
}

function polyPath(poly: Pt[], sx:(x:number)=>number, sy:(y:number)=>number) {
  return poly.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x)},${sy(p.y)}`).join(" ") + " Z";
}

function boundarySeg(dom: Domain2D, k: Constraint) {
  // intersect ax + by = c with rectangle to get visible segment
  const edges = [
    { p: { x: dom.xmin, y: dom.ymin }, q: { x: dom.xmin, y: dom.ymax } },
    { p: { x: dom.xmax, y: dom.ymin }, q: { x: dom.xmax, y: dom.ymax } },
    { p: { x: dom.xmin, y: dom.ymin }, q: { x: dom.xmax, y: dom.ymin } },
    { p: { x: dom.xmin, y: dom.ymax }, q: { x: dom.xmax, y: dom.ymax } },
  ];
  const pts: Pt[] = [];
  for (const e of edges) {
    const dx = e.q.x - e.p.x, dy = e.q.y - e.p.y; const den = k.a * dx + k.b * dy; if (Math.abs(den) < 1e-9) continue; const t = (k.c - (k.a * e.p.x + k.b * e.p.y)) / den; if (t >= -1e-6 && t <= 1 + 1e-6) { const X = { x: e.p.x + t * dx, y: e.p.y + t * dy }; if (X.x >= dom.xmin - 1e-6 && X.x <= dom.xmax + 1e-6 && X.y >= dom.ymin - 1e-6 && X.y <= dom.ymax + 1e-6) pts.push(X); }
  }
  if (pts.length < 2) return null;
  let best: [Pt, Pt] = [pts[0], pts[1]]; let d = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dd = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y); if (dd > d) { d = dd; best = [pts[i], pts[j]]; } }
  return { p: best[0], q: best[1] };
}

// -------------------- UI bits --------------------

function ComparatorToggle({ value, onChange }: { value: Comparator; onChange: (c: Comparator) => void }) {
  const opts: Comparator[] = ["<=", "<", ">=", ">"];
  return (
    <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
      {opts.map((c) => (
        <button key={c} onClick={() => onChange(c)} className={clsx("px-2.5 py-1 text-sm font-mono", value === c ? "bg-slate-900 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}>{c}</button>
      ))}
    </div>
  );
}

function RuleIcon({ label, color }: { label: string; color: string }) {
  const style = { color: colorStroke(color) } as React.CSSProperties;
  if (label.toLowerCase().includes("budget")) return <Wallet className="w-4 h-4" style={style} />;
  if (label.toLowerCase().includes("noise")) return <Volume2 className="w-4 h-4" style={style} />;
  if (label.toLowerCase().includes("security")) return <Shield className="w-4 h-4" style={style} />;
  if (label.toLowerCase().includes("walkway")) return <Move className="w-4 h-4" style={style} />;
  return <Ruler className="w-4 h-4" style={style} />;
}

function Legend() {
  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-slate-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Legend</div>
      <ul className="space-y-1 text-sm text-slate-700">
        <li>• Each rule is a half-plane: <span className="font-mono">a·x + b·y ◻ c</span>.</li>
        <li>• The legal build zone is the intersection polygon of all rules.</li>
        <li>• Binding edge: your plan sits on that boundary. Slack: strictly inside.</li>
        <li>• Hover polygon corners to see vertex coordinates.</li>
      </ul>
    </div>
  );
}

function colorStroke(name: string) {
  switch (name) {
    case "amber": return "#f59e0b";
    case "emerald": return "#10b981";
    case "fuchsia": return "#d946ef";
    case "cyan": return "#06b6d4";
    default: return "#6366f1";
  }
}
function colorBorder(name: string) {
  switch (name) {
    case "amber": return "#fcd34d";
    case "emerald": return "#a7f3d0";
    case "fuchsia": return "#f0abfc";
    case "cyan": return "#a5f3fc";
    default: return "#c7d2fe";
  }
}

// -------------------- Helpers --------------------

function tweak(constraints: Constraint[]): Constraint[] {
  // perturb c slightly and maybe flip a comparator for one rule to make students fix it
  return constraints.map((k, i) => ({
    ...k,
    c: Math.round((k.c + (i % 2 === 0 ? 1 : -1)) * 2) / 2,
    comp: i === 0 && k.comp !== "<" ? (k.comp === "<=" ? "<" : k.comp) : k.comp,
  }));
}