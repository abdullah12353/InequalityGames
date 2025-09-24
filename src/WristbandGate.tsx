import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, CircleSlash2, Play, RotateCcw, ChevronLeft, ChevronRight, Info, Pause, Sparkles } from "lucide-react";
import clsx from "clsx";

// -------------------- Types --------------------

type Interval = {
  lower: number | null; // null => -∞ (unbounded below)
  upper: number | null; // null => +∞ (unbounded above)
  lowerOpen?: boolean;  // true => >
  upperOpen?: boolean;  // true => <
};

type Domain = {
  min: number;
  max: number;
  step: number; // snapping
  format?: (x: number) => string;
  label?: string; // e.g., "yrs", "h"
};

type Level = {
  id: number;
  title: string;
  description: string; // student-facing text rule
  variable: string; // e.g., "Age"
  domain: Domain;
  target: Interval; // the ground truth interval to match
};

type Patron = {
  id: string;
  value: number;
  correct: boolean; // did player's rule agree with target?
  acceptByPlayer: boolean;
  acceptByTarget: boolean;
};

// -------------------- Utility math --------------------

function inInterval(x: number, I: Interval): boolean {
  const lowerOk =
    I.lower === null ? true : I.lowerOpen ? x > I.lower : x >= I.lower;
  const upperOk =
    I.upper === null ? true : I.upperOpen ? x < I.upper : x <= I.upper;
  return lowerOk && upperOk;
}

function intervalsEqual(a: Interval, b: Interval, eps = 1e-9): boolean {
  const eq = (u: number | null, v: number | null) =>
    u === null && v === null ? true : u !== null && v !== null && Math.abs(u - v) < eps;
  return (
    eq(a.lower, b.lower) &&
    eq(a.upper, b.upper) &&
    !!a.lowerOpen === !!b.lowerOpen &&
    !!a.upperOpen === !!b.upperOpen
  );
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}

function snap(x: number, step: number) {
  return Math.round(x / step) * step;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// map value→pixel within [px0, px1]
function scaleX(value: number, domain: Domain, px0: number, px1: number) {
  const t = (value - domain.min) / (domain.max - domain.min);
  return px0 + t * (px1 - px0);
}

function unscaleX(px: number, domain: Domain, px0: number, px1: number) {
  const t = (px - px0) / (px1 - px0);
  return domain.min + t * (domain.max - domain.min);
}

// default formatter
const defaultFmt = (x: number) => {
  const s = x % 1 === 0 ? x.toString() : x.toFixed(1);
  return s;
};

// -------------------- Levels --------------------

const LEVELS: Level[] = [
  {
    id: 1,
    title: "Age Gate: At Least",
    description: "Admit guests aged at least 12.",
    variable: "Age",
    domain: { min: 0, max: 100, step: 1, label: "yrs", format: (x) => `${x}` },
    target: { lower: 12, upper: null, lowerOpen: false, upperOpen: false },
  },
  {
    id: 2,
    title: "Height Check: At Most",
    description: "Ride requires height at most 140 cm.",
    variable: "Height",
    domain: { min: 80, max: 200, step: 1, label: "cm", format: (x) => `${x}` },
    target: { lower: null, upper: 140, lowerOpen: false, upperOpen: false },
  },
  {
    id: 3,
    title: "Skill Test: Strictly Between",
    description: "Only players with score strictly between 30 and 70 enter.",
    variable: "Score",
    domain: { min: 0, max: 100, step: 1, label: "pts", format: (x) => `${x}` },
    target: { lower: 30, upper: 70, lowerOpen: true, upperOpen: true },
  },
  {
    id: 4,
    title: "VIP Line: Mixed Bounds",
    description: "VIP with 60 or more points but under 90.",
    variable: "Score",
    domain: { min: 0, max: 100, step: 1, label: "pts", format: (x) => `${x}` },
    target: { lower: 60, upper: 90, lowerOpen: false, upperOpen: true },
  },
  {
    id: 5,
    title: "Quiet Hours: Evening Window",
    description: "Music allowed between 17:00 and 20:30 inclusive.",
    variable: "Time",
    domain: { min: 12, max: 24, step: 0.5, label: "h", format: (x) => `${Math.floor(x)}:${(x % 1 ? "30" : "00")}` },
    target: { lower: 17, upper: 20.5, lowerOpen: false, upperOpen: false },
  },
  {
    id: 6,
    title: "Budget Tier: Strict Lower",
    description: "Free snack if spend greater than £25 (not equal).",
    variable: "Spend",
    domain: { min: 0, max: 60, step: 1, label: "£", format: (x) => `£${x}` },
    target: { lower: 25, upper: null, lowerOpen: true, upperOpen: false },
  },
];

// -------------------- Component --------------------

export default function WristbandGate({
  onCleared,
  onUpdateBest,
}: { onCleared?: () => void; onUpdateBest?: (acc: number) => void }) {
  const [levelIdx, setLevelIdx] = useState(0);
  const level = LEVELS[levelIdx];

  const [player, setPlayer] = useState<Interval>(() => ({
    lower: level.target.lower ?? level.domain.min,
    upper: level.target.upper ?? level.domain.max,
    lowerOpen: false,
    upperOpen: false,
  }));

  useEffect(() => {
    // Reset when level changes
    setPlayer({
      lower: level.target.lower ?? level.domain.min,
      upper: level.target.upper ?? level.domain.max,
      lowerOpen: !!level.target.lowerOpen,
      upperOpen: !!level.target.upperOpen,
    });
    setPatrons([]);
    setStream(false);
    setScore({ total: 0, correct: 0 });
    setChecked(false);
    setCleared(false);
  }, [levelIdx]);

  const [checked, setChecked] = useState(false);
  const [cleared, setCleared] = useState(false);

  // Simulation
  const [stream, setStream] = useState(false);
  const [patrons, setPatrons] = useState<Patron[]>([]);
  const [score, setScore] = useState({ total: 0, correct: 0 });

  const accuracy = score.total === 0 ? 0 : Math.round((score.correct / score.total) * 100);

  // report accuracy to dashboard
  useEffect(() => {
    onUpdateBest?.(accuracy);
  }, [accuracy, onUpdateBest]);

  // auto-mark level cleared in dashboard
  useEffect(() => {
    if (cleared) onCleared?.();
  }, [cleared, onCleared]);

  useEffect(() => {
    if (!stream) return;
    const id = setInterval(() => {
      const v = snap(
        level.domain.min + Math.random() * (level.domain.max - level.domain.min),
        level.domain.step
      );
      const acceptPlayer = inInterval(v, player);
      const acceptTarget = inInterval(v, level.target);
      const ok = acceptPlayer === acceptTarget;
      setPatrons((ps) => [
        {
          id: uid(),
          value: v,
          correct: ok,
          acceptByPlayer: acceptPlayer,
          acceptByTarget: acceptTarget,
        },
        ...ps.slice(0, 39), // keep 40 recent
      ]);
      setScore((s) => ({ total: s.total + 1, correct: s.correct + (ok ? 1 : 0) }));
    }, 900);
    return () => clearInterval(id);
  }, [stream, player, level]);

  useEffect(() => {
    // auto-clear when accuracy ≥90 and at least 20 patrons
    if (!cleared && score.total >= 20 && accuracy >= 90) {
      setCleared(true);
    }
  }, [accuracy, score.total, cleared]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Header level={level} setLevelIdx={setLevelIdx} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <RuleCard
            level={level}
            player={player}
            setPlayer={setPlayer}
            checked={checked}
            setChecked={setChecked}
            match={intervalsEqual(player, level.target)}
          />

          <div className="mt-4">
            <NumberLineEditor level={level} player={player} setPlayer={setPlayer} />
          </div>

          <Controls
            stream={stream}
            setStream={setStream}
            onReset={() => {
              setPatrons([]);
              setScore({ total: 0, correct: 0 });
              setChecked(false);
              setCleared(false);
            }}
            checked={checked}
            match={intervalsEqual(player, level.target)}
          />
        </div>

        <div className="lg:col-span-1">
          <ScoreBoard accuracy={accuracy} total={score.total} correct={score.correct} cleared={cleared} />

          <StreamPanel patrons={patrons} domain={level.domain} variable={level.variable} />

          <Legend domain={level.domain} />
        </div>
      </div>

      <AnimatePresence>
        {cleared && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none"
          >
            <ConfettiOverlay />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// -------------------- UI Pieces --------------------

function Header({ level, setLevelIdx }: { level: Level; setLevelIdx: React.Dispatch<React.SetStateAction<number>>; }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl shadow p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-indigo-100 text-indigo-700 w-10 h-10 grid place-items-center font-bold">{level.id}</div>
        <div>
          <h1 className="text-xl font-semibold">Wristband Gate</h1>
          <p className="text-slate-600 text-sm">Level {level.id}: {level.title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
          onClick={() => setLevelIdx((i) => Math.max(0, i - 1))}
          aria-label="Previous level"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200"
          onClick={() => setLevelIdx((i) => Math.min(LEVELS.length - 1, i + 1))}
          aria-label="Next level"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function RuleCard({ level, player, setPlayer, checked, setChecked, match }: { level: Level; player: Interval; setPlayer: (i: Interval) => void; checked: boolean; setChecked: (b: boolean) => void; match: boolean; }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1"><Info className="w-5 h-5 text-slate-500" /></div>
        <div className="flex-1">
          <div className="text-sm uppercase tracking-wide text-slate-500">Rule</div>
          <div className="text-lg font-medium">{level.description}</div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-indigo-600" checked={player.lower === null} onChange={(e) => setPlayer({ ...player, lower: e.target.checked ? null : level.domain.min })} /> No lower bound</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-indigo-600" checked={player.upper === null} onChange={(e) => setPlayer({ ...player, upper: e.target.checked ? null : level.domain.max })} /> No upper bound</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-indigo-600" checked={!!player.lowerOpen} onChange={(e) => setPlayer({ ...player, lowerOpen: e.target.checked })} /> Lower is open (&gt;)</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-indigo-600" checked={!!player.upperOpen} onChange={(e) => setPlayer({ ...player, upperOpen: e.target.checked })} /> Upper is open (&lt;)</label>
          </div>

          <div className="mt-3 text-slate-600 text-sm">
            Your current band: {renderInterval(player, level.domain)}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              className={clsx(
                "px-4 py-2 rounded-xl text-white",
                match ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
              )}
              onClick={() => setChecked(true)}
            >
              {match ? "Perfect Match!" : "Check Rule"}
            </button>
            {checked && (
              <div className={clsx("flex items-center gap-2 text-sm font-medium", match ? "text-emerald-700" : "text-rose-700")}>{match ? <CheckCircle2 className="w-5 h-5"/> : <CircleSlash2 className="w-5 h-5"/>}{match ? "Exactly matches the rule" : "Not matching yet—adjust interval"}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderInterval(I: Interval, domain: Domain) {
  const fmt = domain.format ?? defaultFmt;
  const left = I.lower === null ? "−∞" : fmt(I.lower);
  const right = I.upper === null ? "+∞" : fmt(I.upper);
  const lbr = I.lowerOpen ? "(" : "[";
  const rbr = I.upperOpen ? ")" : "]";
  const unit = domain.label ? (v: string) => `${v}${domain.label === "£" ? "" : ""}` : (v: string) => v;
  return `${lbr}${unit(left)}, ${unit(right)}${rbr}`;
}

function Controls({ stream, setStream, onReset, checked, match }: { stream: boolean; setStream: (b: boolean) => void; onReset: () => void; checked: boolean; match: boolean; }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        className={clsx(
          "px-4 py-2 rounded-xl text-white flex items-center gap-2",
          stream ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
        )}
        onClick={() => setStream(!stream)}
      >
        {stream ? <><Pause className="w-5 h-5"/> Pause Stream</> : <><Play className="w-5 h-5"/> Start Stream</>}
      </button>
      <button className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 flex items-center gap-2" onClick={onReset}><RotateCcw className="w-5 h-5"/> Reset</button>
      <div className="text-sm text-slate-600">Tip: {checked ? (match ? "Great! Now test it with the stream." : "Adjust handles and try Check again.") : "Use Check Rule to see if your band matches the text."}</div>
    </div>
  );
}

function ScoreBoard({ accuracy, total, correct, cleared }: { accuracy: number; total: number; correct: number; cleared: boolean; }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm uppercase tracking-wide text-slate-500">Performance</div>
          <div className="text-2xl font-bold">{accuracy}% accuracy</div>
          <div className="text-slate-600 text-sm">{correct} / {total} decisions matched the rule</div>
        </div>
        <div className={clsx("rounded-xl px-3 py-2 text-sm font-semibold", cleared ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700")}>{cleared ? "Cleared ≥90% over 20" : "Goal: ≥90% over 20"}</div>
      </div>
    </div>
  );
}

function StreamPanel({ patrons, domain, variable }: { patrons: Patron[]; domain: Domain; variable: string; }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const obs = new ResizeObserver(() => setWidth(containerRef.current?.clientWidth ?? 0));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const px0 = 12, px1 = Math.max(12, width - 12);

  return (
    <div className="bg-white rounded-2xl shadow p-4 mt-4" ref={containerRef}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm uppercase tracking-wide text-slate-500">Patron Stream</div>
        <div className="text-slate-600 text-sm">{variable} samples</div>
      </div>
      <div className="relative h-36 border border-slate-200 rounded-xl overflow-hidden bg-gradient-to-b from-white to-slate-50">
        <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-0.5 bg-slate-300" />
        {/* Ticks */}
        <Ticks domain={domain} px0={px0} px1={px1} />
        <AnimatePresence>
          {patrons.map((p) => (
            <motion.div
              key={p.id}
              initial={{ y: -60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute"
              style={{ left: scaleX(p.value, domain, px0, px1) - 6, top: 12 }}
            >
              <div className={clsx(
                "w-3 h-3 rounded-full shadow",
                p.correct ? (p.acceptByPlayer ? "bg-emerald-500" : "bg-sky-500") : "bg-rose-500"
              )} />
              <div className="text-[10px] text-slate-600 mt-1 text-center">
                {domain.format ? domain.format(p.value) : defaultFmt(p.value)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"/> accepted ✔️ & correct ·
        <span className="inline-block w-2 h-2 rounded-full bg-sky-500"/> rejected ✔️ & correct ·
        <span className="inline-block w-2 h-2 rounded-full bg-rose-500"/> decision ❌ (mismatch with rule)
      </div>
    </div>
  );
}

function Legend({ domain }: { domain: Domain }) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 mt-4">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Legend</div>
      <ul className="space-y-1 text-sm text-slate-700">
        <li>• Filled endpoint = inclusive (≤ or ≥)</li>
        <li>• Hollow endpoint = strict (&lt; or &gt;)</li>
        <li>• Green band = allowed interval</li>
        <li>• Ticks show {domain.label ?? "values"} with snapping step {domain.step}</li>
      </ul>
    </div>
  );
}

function NumberLineEditor({ level, player, setPlayer }: { level: Level; player: Interval; setPlayer: (i: Interval) => void; }) {
  const domain = level.domain;
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const obs = new ResizeObserver(() => setWidth(ref.current?.clientWidth ?? 0));
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const px0 = 16, px1 = Math.max(16, width - 16);

  const lowerPx = useMemo(() => {
    const v = player.lower === null ? domain.min : player.lower;
    return scaleX(v, domain, px0, px1);
  }, [player.lower, domain, px0, px1]);

  const upperPx = useMemo(() => {
    const v = player.upper === null ? domain.max : player.upper;
    return scaleX(v, domain, px0, px1);
  }, [player.upper, domain, px0, px1]);

  function handleDrag(e: React.MouseEvent, which: "lower" | "upper") {
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left; // within container
    const val = snap(clamp(unscaleX(x, domain, px0, px1), domain.min, domain.max), domain.step);

    if (which === "lower") {
      const next = Math.min(val, player.upper === null ? domain.max : player.upper);
      setPlayer({ ...player, lower: next });
    } else {
      const next = Math.max(val, player.lower === null ? domain.min : player.lower);
      setPlayer({ ...player, upper: next });
    }
  }

  function onLineClick(e: React.MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const v = snap(clamp(unscaleX(x, domain, px0, px1), domain.min, domain.max), domain.step);
    // smart move: if closer to lower, move lower; else upper
    const dl = Math.abs(v - (player.lower ?? domain.min));
    const du = Math.abs(v - (player.upper ?? domain.max));
    if (dl <= du) setPlayer({ ...player, lower: v });
    else setPlayer({ ...player, upper: v });
  }

  const fmt = domain.format ?? defaultFmt;

  const bandLeftPx = player.lower === null ? px0 : scaleX(player.lower, domain, px0, px1);
  const bandRightPx = player.upper === null ? px1 : scaleX(player.upper, domain, px0, px1);

  return (
    <div className="bg-white rounded-2xl shadow p-4">
      <div className="text-sm uppercase tracking-wide text-slate-500 mb-2">Number Line</div>
      <div className="relative h-28" ref={ref}>
        {/* base line */}
        <div className="absolute left-4 right-4 top-16 h-0.5 bg-slate-300" onClick={onLineClick} />

        {/* feasible band */}
        <div
          className="absolute top-[56px] h-4 bg-emerald-200/60 rounded"
          style={{ left: bandLeftPx, width: Math.max(0, bandRightPx - bandLeftPx) }}
        />

        {/* ticks */}
        <Ticks domain={domain} px0={px0} px1={px1} y={16} showLabels />

        {/* lower handle */}
        <Handle
          x={lowerPx}
          label={player.lower === null ? "−∞" : fmt(player.lower)}
          open={!!player.lowerOpen}
          disabled={player.lower === null}
          onDrag={(e) => handleDrag(e, "lower")}
        />

        {/* upper handle */}
        <Handle
          x={upperPx}
          label={player.upper === null ? "+∞" : fmt(player.upper)}
          open={!!player.upperOpen}
          disabled={player.upper === null}
          onDrag={(e) => handleDrag(e, "upper")}
        />
      </div>
      <div className="mt-2 text-xs text-slate-600">Click the line or drag handles. Toggle bounds & open/closed above.</div>
    </div>
  );
}

function Ticks({ domain, px0, px1, y = 64, showLabels = false }: { domain: Domain; px0: number; px1: number; y?: number; showLabels?: boolean; }) {
  const ticks = useMemo(() => {
    const arr: number[] = [];
    const step = domain.step;
    for (let v = domain.min; v <= domain.max + 1e-9; v += step) arr.push(Number(v.toFixed(5)));
    // thin out labels if many
    const every = arr.length > 16 ? Math.ceil(arr.length / 16) : 1;
    return { arr, every };
  }, [domain]);

  const fmt = domain.format ?? defaultFmt;

  return (
    <div className="absolute left-4 right-4" style={{ top: y }}>
      {ticks.arr.map((v, i) => {
        const x = scaleX(v, domain, px0, px1);
        const label = fmt(v);
        const show = showLabels && i % ticks.every === 0;
        return (
          <div key={i} className="absolute" style={{ left: x, transform: "translateX(-50%)" }}>
            <div className="w-px h-3 bg-slate-400" />
            {show && <div className="text-[10px] text-slate-600 mt-1 text-center whitespace-nowrap">{label}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Handle({ x, label, open, onDrag, disabled }: { x: number; label: string; open: boolean; onDrag: (e: React.MouseEvent) => void; disabled?: boolean; }) {
  const [drag, setDrag] = useState(false);

  return (
    <div
      className="absolute top-12"
      style={{ left: x, transform: "translateX(-50%)" }}
      onMouseDown={() => !disabled && setDrag(true)}
      onMouseUp={() => setDrag(false)}
      onMouseLeave={() => setDrag(false)}
      onMouseMove={(e) => drag && !disabled && onDrag(e)}
    >
      <div className={clsx("w-5 h-5 grid place-items-center rounded-full border-2 shadow",
        disabled ? "bg-slate-200 border-slate-300" : open ? "bg-white border-slate-500" : "bg-slate-800 border-slate-800"
      )}>
        {/* filled when closed (inclusive), hollow when open (strict) */}
      </div>
      <div className="text-xs text-slate-700 mt-1 text-center whitespace-nowrap">{label}</div>
    </div>
  );
}

function ConfettiOverlay() {
  // lightweight confetti sensation
  const pieces = Array.from({ length: 80 }).map(() => ({
    id: uid(),
    x: Math.random() * 100,
    d: 30 + Math.random() * 60,
    s: 6 + Math.random() * 12,
    r: Math.random() * 360,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: -40, rotate: p.r, opacity: 0 }}
          animate={{ x: `${p.x + (Math.random()*20-10)}vw`, y: `${p.d}vh`, rotate: p.r + 180, opacity: 1 }}
          transition={{ duration: 1.2 + Math.random()*0.8, ease: "easeOut" }}
          className="w-2 h-3 rounded-sm"
          style={{ backgroundColor: ["#10b981","#6366f1","#f59e0b","#ef4444"][Math.floor(Math.random()*4)] }}
        />
      ))}
      <div className="absolute inset-x-0 top-10 flex justify-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/90 shadow text-emerald-700 font-semibold"><Sparkles className="w-5 h-5"/> Level Cleared!</span>
      </div>
    </div>
  );
}
