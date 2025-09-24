/*
Speed Zone Supervisor — Simple (Game 1.5)
Theme: Clear road + cars. Teach 1D inequalities with as-few-controls-as-possible.
Age: 10–15 | 2D | React + Tailwind v4 + Framer Motion

Pedagogy & Scope (much simpler)
- Only ONE quantity: speed v on a number line.
- Only inclusive bounds: ≥ and ≤. (No strict endpoints in this game.)
- Compulsory walkthrough of 3 tiny examples that build the story:
  1) Min speed (merge lane) → v ≥ 30
  2) Max speed (quiet street) → v ≤ 50
  3) Safe window (school zone) → 20 ≤ v ≤ 35
- Open Play: short "waves" of cars. Kids tune the bounds to meet simple goals.
- Visuals: animated car icons appearing at their speed; the legal zone is a bright band.

Integration
- Save as src/SpeedZone.tsx (replace the previous game 1.5 component)
- Register in src/games/registry.tsx (snippet at bottom)
*/

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Car, ChevronLeft, ChevronRight, Lock, RotateCcw, Sparkles } from "lucide-react";
import clsx from "clsx";

// ---------- Types ----------

type Domain1D = { min: number; max: number; step: number };

type Rule = {
  useLeft: boolean; // show left bound (≥ L)
  useRight: boolean; // show right bound (≤ R)
  left: number; // L
  right: number; // R
};

type Level = { id: number; title: string; story: string; dom: Domain1D; target: Rule; lock: { left: boolean; right: boolean } };

type CarSpawn = { id: string; v: number; ok: boolean };

// ---------- Helpers ----------

const clamp = (x:number,a:number,b:number)=> Math.max(a, Math.min(b, x));
const rint = (x:number)=> Math.round(x);

function inside(rule: Rule, v: number){
  if(rule.useLeft && v < rule.left) return false;
  if(rule.useRight && v > rule.right) return false;
  return true;
}

function sameRule(a:Rule,b:Rule){
  return a.useLeft===b.useLeft && a.useRight===b.useRight && rint(a.left)===rint(b.left) && rint(a.right)===rint(b.right);
}

function ruleText(rule: Rule){
  if(rule.useLeft && rule.useRight) return `${rule.left} ≤ v ≤ ${rule.right}`;
  if(rule.useLeft) return `v ≥ ${rule.left}`;
  if(rule.useRight) return `v ≤ ${rule.right}`;
  return "all v";
}

// ---------- Levels (walkthrough) ----------

const LEVELS: Level[] = [
  { id: 1, title: "Merge Lane — Minimum Speed", story: "Officer Dot: ‘Cars must be at least 30 km/h to merge safely.’", dom: { min: 0, max: 100, step: 1 }, target: { useLeft: true, useRight: false, left: 30, right: 100 }, lock: { left: true, right: false } },
  { id: 2, title: "Quiet Street — Maximum Speed", story: "Resident Rhea: ‘Please cap speeds at 50 km/h.’", dom: { min: 0, max: 100, step: 1 }, target: { useLeft: false, useRight: true, left: 0, right: 50 }, lock: { left: false, right: true } },
  { id: 3, title: "School Zone — Safe Window", story: "Coach Kim: ‘Keep it between 20 and 35 during pickup.’", dom: { min: 0, max: 100, step: 1 }, target: { useLeft: true, useRight: true, left: 20, right: 35 }, lock: { left: true, right: true } },
];

// ---------- Component ----------

export default function SpeedZone({ onCleared, onUpdateBest }: { onCleared?: () => void; onUpdateBest?: (acc: number) => void }){
  // gate Open Play until all examples cleared
  const [clearedExamples, setClearedExamples] = useState<boolean[]>([false,false,false]);
  const allCleared = clearedExamples.every(Boolean);

  const [mode, setMode] = useState<"examples"|"open">("examples");
  useEffect(()=>{ if(mode==="open" && !allCleared) setMode("examples"); }, [mode, allCleared]);

  const [idx, setIdx] = useState(0);
  const L = LEVELS[idx];

  // Player rule starts near target with tiny offsets to fix
  const [rule, setRule] = useState<Rule>(()=> tweak(L.target));
  useEffect(()=>{ setRule(tweak(LEVELS[idx].target)); setChecked(false); setMatched(false); setCars([]); setScore({ ok:0,total:0,streak:0,viol:0 }); }, [idx]);

  const [checked, setChecked] = useState(false);
  const [matched, setMatched] = useState(false);
  useEffect(()=>{ if(checked && sameRule(rule, L.target)){ setMatched(true); const copy=[...clearedExamples]; copy[idx]=true; setClearedExamples(copy); onCleared?.(); } }, [checked, rule, L, clearedExamples, idx, onCleared]);

  // Stream simple car dots (shared visual, slower in examples)
  const [cars, setCars] = useState<CarSpawn[]>([]);
  const [score, setScore] = useState({ ok:0,total:0,streak:0,viol:0 });

  useEffect(()=>{
    const delay = mode==="examples"? 1000 : 700;
    const t = setInterval(()=>{
      setCars(prev => {
        const v = rint(L.dom.min + Math.random()*(L.dom.max-L.dom.min));
        const ok = inside(rule, v);
        setScore(s=> ({ ok: s.ok + (ok?1:0), total: s.total + 1, streak: ok? s.streak+1:0, viol: s.viol + (ok?0:1) }));
        const item: CarSpawn = { id: Math.random().toString(36).slice(2), v, ok };
        const next = [...prev, item];
        return next.slice(-24);
      });
    }, delay);
    return ()=> clearInterval(t);
  }, [rule, mode, L.dom.min, L.dom.max]);

  useEffect(()=>{ if(mode==="open"){ const acc = score.total? Math.round(100*score.ok/score.total):0; onUpdateBest?.(acc); } }, [mode, score, onUpdateBest]);

  return (
    <div className="min-h-screen road-bg">
      <div className="mx-auto max-w-5xl p-6">
        <Header mode={mode} setMode={setMode} allCleared={allCleared} score={score} />

        {mode==="examples"? (
          <ExamplesView
            L={L}
            idx={idx} setIdx={setIdx}
            rule={rule} setRule={setRule}
            checked={checked} setChecked={setChecked} matched={matched}
            cars={cars}
            clearedExamples={clearedExamples}
          />
        ) : (
          <OpenPlay
            rule={rule} setRule={setRule}
            cars={cars}
            score={score} setScore={setScore}
            onCleared={onCleared}
          />
        )}

        <AnimatePresence>
          {matched && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none">
              <ConfettiOverlay label="Nice! Target rule matched." />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Header({ mode, setMode, allCleared, score }: { mode:"examples"|"open"; setMode:(m:"examples"|"open")=>void; allCleared:boolean; score:{ok:number;total:number} }){
  const acc = score.total? Math.round(100*score.ok/score.total):0;
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl shadow p-4 border border-amber-200 flex items-center justify-between">
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">Speed Zone Supervisor</div>
        <div className="text-slate-600 text-sm">Set a simple speed rule; watch cars pass; adjust until it works.</div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <div className="text-xs text-slate-500">Accuracy</div>
          <div className="text-xl font-bold">{acc}%</div>
        </div>
        <div className="inline-flex rounded-xl overflow-hidden border border-slate-200">
          <button onClick={()=> setMode("examples")} className={clsx("px-3 py-2 text-sm", mode==="examples"?"bg-amber-500 text-white":"bg-white text-slate-700")}>Walkthrough</button>
          <button onClick={()=> allCleared && setMode("open")} className={clsx("px-3 py-2 text-sm flex items-center gap-1", mode==="open"?"bg-amber-500 text-white":"bg-white text-slate-700", !allCleared && "opacity-60")}>{!allCleared && <Lock className="w-4 h-4"/>} Open Play</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Walkthrough ----------

function ExamplesView({ L, idx, setIdx, rule, setRule, checked, setChecked, matched, cars, clearedExamples }: { L:Level; idx:number; setIdx:(i:number)=>void; rule:Rule; setRule:(r:Rule)=>void; checked:boolean; setChecked:(b:boolean)=>void; matched:boolean; cars:CarSpawn[]; clearedExamples:boolean[] }){
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl shadow p-4 bg-white/90 border border-amber-200">
          <div className="flex items-start gap-3">
            <div className="rounded-full w-10 h-10 grid place-items-center bg-amber-100 text-amber-700 font-bold">{L.id}</div>
            <div className="flex-1">
              <div className="text-lg font-semibold">{L.title}</div>
              <div className="text-slate-700">{L.story}</div>
              <p className="mt-2 text-sm text-slate-600">Drag the <strong>{L.lock.left?"left":L.lock.right?"right":""}</strong> bound to match the rule, then press <em>Check</em>.</p>
              <div className="mt-2 text-sm font-mono">Target: {ruleText(L.target)}</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={()=> setIdx(Math.max(0, idx-1))}><ChevronLeft className="w-5 h-5"/></button>
              <button className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={()=> setIdx(Math.min(LEVELS.length-1, idx+1))}><ChevronRight className="w-5 h-5"/></button>
            </div>
          </div>
        </div>

        <NumberLine dom={L.dom} rule={rule} cars={cars} />

        <Controls rule={rule} setRule={setRule} dom={L.dom} lock={L.lock} />

        <div className="flex items-center gap-3">
          <button className={clsx("px-4 py-2 rounded-xl text-white", matched?"bg-emerald-600 hover:bg-emerald-700":"bg-amber-500 hover:bg-amber-600")} onClick={()=> setChecked(true)}>
            {matched?"Perfect Match!":"Check"}
          </button>
          {checked && (
            <div className={clsx("text-sm", matched?"text-emerald-700":"text-rose-700")}>{matched?"Exactly matched the target." : "Not yet—adjust the bound(s)."}</div>
          )}
        </div>
      </div>

      <div className="lg:col-span-1 space-y-4">
        <LegendPanel cleared={clearedExamples} />
      </div>
    </div>
  );
}

// ---------- Open Play (short waves) ----------

function OpenPlay({ rule, setRule, cars, score, setScore, onCleared }: { rule:Rule; setRule:(r:Rule)=>void; cars:CarSpawn[]; score:{ok:number;total:number;streak:number;viol:number}; setScore:(s:{ok:number;total:number;streak:number;viol:number})=>void; onCleared?:()=>void }){
  const dom = { min:0, max:100, step:1 };
  const [waveOn, setWaveOn] = useState(false);
  const [waveCount, setWaveCount] = useState(0);
  const GOAL = { cars: 30, maxViolRate: 0.15, streak: 10 };

  // start/stop simple wave timer (independent from car stream visual above)
  useEffect(()=>{
    if(!waveOn) return;
    const t = setInterval(()=> setWaveCount(c=> c+1), 700);
    return ()=> clearInterval(t);
  }, [waveOn]);

  useEffect(()=>{
    if(!waveOn) return;
    if(waveCount >= GOAL.cars){
      setWaveOn(false);
      const rate = score.total? score.viol/score.total : 1;
      const cleared = rate <= GOAL.maxViolRate && score.streak >= GOAL.streak;
      if(cleared) onCleared?.();
    }
  }, [waveCount, waveOn, score, onCleared]);

  const rate = score.total? score.viol/score.total : 0;
  const goals = {
    volume: waveCount >= GOAL.cars,
    lowViol: rate <= GOAL.maxViolRate,
    streak: score.streak >= GOAL.streak,
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl shadow p-4 bg-white/90 border border-amber-200 flex items-center justify-between">
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-500">Open Play — Wave</div>
            <div className="text-lg">Pass {GOAL.cars} cars with ≤{Math.round(GOAL.maxViolRate*100)}% violations and a streak ≥ {GOAL.streak}.</div>
            <div className="text-slate-600 text-sm">Current rule: <span className="font-mono">{ruleText(rule)}</span></div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{waveCount}/{GOAL.cars}</div>
            {waveOn ? (
              <button className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100" onClick={()=> setWaveOn(false)}>Pause</button>
            ) : (
              <button className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 text-white" onClick={()=> { setWaveOn(true); setWaveCount(0); setScore({ ok:0,total:0,streak:0,viol:0 }); }}>Start Wave</button>
            )}
          </div>
        </div>

        <NumberLine dom={dom} rule={rule} cars={cars} />
        <Controls rule={rule} setRule={setRule} dom={dom} />
      </div>

      <div className="lg:col-span-1 space-y-4">
        <MissionCard goals={goals} rate={rate} score={score} />
        <div className="rounded-2xl shadow p-4 bg-white/90 border border-amber-200">
          <div className="text-sm uppercase tracking-wide text-slate-500">Reset</div>
          <button className="mt-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200" onClick={()=> setScore({ ok:0,total:0,streak:0,viol:0 })}><RotateCcw className="w-4 h-4 inline mr-1"/> Counters</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Controls (very small surface area) ----------

function Controls({ rule, setRule, dom, lock }: { rule:Rule; setRule:(r:Rule)=>void; dom:Domain1D; lock?:{ left?:boolean; right?:boolean } }){
  return (
    <div className="rounded-2xl shadow p-4 bg-white/90 border border-amber-200">
      <div className="text-sm uppercase tracking-wide text-slate-500">Your Speed Rule</div>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={rule.useLeft} onChange={(e)=> setRule({ ...rule, useLeft: e.target.checked, left: Math.min(rule.left, rule.right) })} disabled={lock?.left} />
            <span>Minimum speed (≥ L)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono">L =</span>
            <input type="range" min={dom.min} max={dom.max} step={dom.step} value={rule.left} onChange={(e)=> setRule({ ...rule, left: clamp(parseFloat(e.target.value), dom.min, rule.useRight? Math.min(rule.right, dom.max): dom.max) })} disabled={!rule.useLeft} className="flex-1"/>
            <span className="font-mono w-12 text-right">{rint(rule.left)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={rule.useRight} onChange={(e)=> setRule({ ...rule, useRight: e.target.checked, right: Math.max(rule.right, rule.left) })} disabled={lock?.right} />
            <span>Maximum speed (≤ R)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono">R =</span>
            <input type="range" min={dom.min} max={dom.max} step={dom.step} value={rule.right} onChange={(e)=> setRule({ ...rule, right: clamp(parseFloat(e.target.value), rule.useLeft? Math.max(rule.left, dom.min): dom.min, dom.max) })} disabled={!rule.useRight} className="flex-1"/>
            <span className="font-mono w-12 text-right">{rint(rule.right)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 text-sm">Inequality: <span className="font-mono">{ruleText(rule)}</span></div>
    </div>
  );
}

// ---------- Number Line + Car visuals ----------

function NumberLine({ dom, rule, cars }: { dom:Domain1D; rule:Rule; cars:CarSpawn[] }){
  return (
    <div className="rounded-2xl shadow border border-amber-200 overflow-hidden">
      <div className="relative">
        <LineSVG dom={dom} rule={rule} />
        <CarLayer dom={dom} cars={cars} />
        <div className="absolute top-3 right-3 bg-white/90 border border-amber-300 text-amber-700 px-2 py-1 rounded-lg text-sm font-mono">{ruleText(rule)}</div>
      </div>
    </div>
  );
}

function LineSVG({ dom, rule }: { dom:Domain1D; rule:Rule }){
  const ref = useRef<HTMLDivElement|null>(null);
  const [W,setW] = useState(0);
  useEffect(()=>{ const ro = new ResizeObserver(()=> setW(ref.current?.clientWidth ?? 0)); if(ref.current) ro.observe(ref.current); return ()=> ro.disconnect(); },[]);
  const H = 150; const pad = 24; const width = Math.max(320, W);
  const sx = (x:number)=> pad + ((x-dom.min)/(dom.max-dom.min))*(width-2*pad);

  const leftX = rule.useLeft? sx(rule.left): sx(dom.min);
  const rightX = rule.useRight? sx(rule.right): sx(dom.max);
  const hasBand = rule.useLeft || rule.useRight;

  return (
    <div ref={ref}>
      <svg width={width} height={H} className="block bg-road">
        <defs>
          <linearGradient id="zone" x1="0" x2="1">
            <stop offset="0%" stopColor="#fbbf24"/>
            <stop offset="100%" stopColor="#fde68a"/>
          </linearGradient>
        </defs>
        {/* baseline road */}
        <rect x={0} y={70} width={width} height={6} fill="#0b1220aa" />
        {/* ticks & labels */}
        {Array.from({length: 11}).map((_,i)=>{ const x = dom.min + i*(dom.max-dom.min)/10; const X=sx(x); return <g key={i}><line x1={X} y1={66} x2={X} y2={82} stroke="#0b1220aa" strokeWidth={1.5}/><text x={X} y={100} textAnchor="middle" fontSize={10} fill="#334155">{Math.round(x)}</text></g>; })}

        {/* shaded legal zone */}
        {hasBand && (
          <rect x={Math.min(leftX,rightX)} y={50} width={Math.abs(rightX-leftX)} height={40} fill="#fde68a66" stroke="url(#zone)" strokeWidth={2} />
        )}

        {/* endpoints (solid dots because inclusive) */}
        {rule.useLeft && (<circle cx={leftX} cy={70+3} r={8} fill="#f59e0b" stroke="#92400e" strokeWidth={2} />)}
        {rule.useRight && (<circle cx={rightX} cy={70+3} r={8} fill="#f59e0b" stroke="#92400e" strokeWidth={2} />)}
      </svg>
    </div>
  );
}

function CarLayer({ dom, cars }: { dom:Domain1D; cars:CarSpawn[] }){
  const ref = useRef<HTMLDivElement|null>(null);
  const [W,setW] = useState(0);
  useEffect(()=>{ const ro = new ResizeObserver(()=> setW(ref.current?.clientWidth ?? 0)); if(ref.current) ro.observe(ref.current); return ()=> ro.disconnect(); },[]);
  const pad = 24; const width = Math.max(320, W); const sx = (x:number)=> pad + ((x-dom.min)/(dom.max-dom.min))*(width-2*pad);
  return (
    <div ref={ref} className="pointer-events-none">
      <div className="absolute inset-0">
        {cars.map((c)=> (
          <motion.div key={c.id} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: -2 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} style={{ position:"absolute", left: sx(c.v)-10, top: 28 }}>
            <div className={clsx("px-1.5 py-1 rounded-lg text-xs font-mono border flex items-center gap-1", c.ok?"bg-emerald-100 border-emerald-300 text-emerald-800":"bg-rose-100 border-rose-300 text-rose-800")}>
              <Car className="w-3 h-3"/> {c.v}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ---------- Side panels ----------

function LegendPanel({ cleared }: { cleared:boolean[] }){
  return (
    <div className="rounded-2xl shadow p-4 bg-white/90 border border-amber-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Legend</div>
      <ul className="space-y-1 text-sm text-slate-700">
        <li>• Solid dots mean “include the endpoint” (≥ or ≤ only in this game).</li>
        <li>• Shaded band is the legal speed zone.</li>
        <li>• Cars show where their speed lands. Green = pass, Red = violation.</li>
        <li>• Finish the 3-step walkthrough to unlock Open Play.</li>
      </ul>
      <div className="mt-3 text-xs text-slate-500">Walkthrough status: {cleared.filter(Boolean).length}/3 cleared.</div>
    </div>
  );
}

function MissionCard({ goals, rate, score }: { goals:{volume:boolean; lowViol:boolean; streak:boolean}; rate:number; score:{ ok:number; total:number; streak:number } }){
  const Item = ({ok, label}:{ok:boolean; label:string}) => (
    <div className="flex items-center gap-2 text-sm"><span className={clsx("inline-flex items-center justify-center w-5 h-5 rounded-full", ok?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-600")}>{ok?"✓":"•"}</span><span className={clsx(ok?"text-slate-700":"text-slate-600")}>{label}</span></div>
  );
  return (
    <div className="rounded-2xl shadow p-4 bg-white/90 border border-amber-200">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Wave Goals</div>
      <Item ok={goals.volume} label="Process all cars in the wave"/>
      <Item ok={goals.lowViol} label={`Violations ≤ ${Math.round(100*0.15)}% (now ${Math.round(100*rate)}%)`}/>
      <Item ok={goals.streak} label={`Streak ≥ 10 (now ${score.streak})`}/>
      <div className="mt-2 text-sm">Accepted: <span className="font-mono">{score.ok}</span> · Total: <span className="font-mono">{score.total}</span></div>
    </div>
  );
}

// ---------- Confetti ----------

function ConfettiOverlay({ label }: { label:string }){
  const pieces = Array.from({ length: 60 }).map(()=> ({ id: Math.random().toString(36).slice(2), x: Math.random()*100, d: 30 + Math.random()*60, r: Math.random()*360 }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map(p=> (
        <motion.div key={p.id} initial={{ x: `${p.x}vw`, y: -40, rotate: p.r, opacity: 0 }} animate={{ x: `${p.x + (Math.random()*20-10)}vw`, y: `${p.d}vh`, rotate: p.r + 180, opacity: 1 }} transition={{ duration: 1.2 + Math.random()*0.8, ease: "easeOut" }} className="w-2 h-3 rounded-sm" style={{ background: ["#f59e0b", "#fde68a", "#34d399"][Math.floor(Math.random()*3)] }} />
      ))}
      <div className="absolute inset-x-0 top-10 flex justify-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 shadow text-slate-800 font-semibold"><Sparkles className="w-5 h-5"/> {label}</span>
      </div>
    </div>
  );
}

// ---------- Tweaks ----------

function tweak(t: Rule): Rule {
  // Gentle nudge so learners must adjust
  return {
    ...t,
    left: t.useLeft ? clamp(Math.round((t.left + (Math.random()<0.5?-3:3))), 0, t.right) : t.left,
    right: t.useRight ? clamp(Math.round((t.right + (Math.random()<0.5?3:-3))), t.left, 100) : t.right,
  };
}

// ---------- Styling helpers (optional) ----------
/* Add to src/index.css for the road vibe:
.road-bg { background: radial-gradient(900px 450px at 10% -10%, #fde68a40, transparent),
                     radial-gradient(900px 450px at 90% 10%, #fef3c740, transparent),
                     linear-gradient(#fff7ed, #ecfeff); }
.bg-road  { background: linear-gradient(180deg, #fff7ed, #ecfeff); }
*/

// ---------- Registry snippet (add to src/games/registry.tsx) ----------
// import { Gauge } from "lucide-react";
// const SpeedZone = lazy(() => import("../SpeedZone"));
// GAMES.push({
//   id: "speed-zone",
//   title: "Speed Zone Supervisor",
//   short: "Basics of inequalities via speed limits (super simple).",
//   route: "/games/speed-zone",
//   estMinutes: 5,
//   difficulty: "intro",
//   tags: ["number line", "intervals", "inequalities"],
//   component: SpeedZone,
//   icon: <Gauge className="w-5 h-5"/>,
// });
