import { lazy } from "react";
import type { GameMeta } from "../types";
import {
  ShieldCheck,
  Ruler,
  Sparkles,
  Landmark,
  Gauge,
  Trees,
} from "lucide-react";

// Lazy-load game components (existing files)
const WristbandGate = lazy(() => import("../WristbandGate"));
const SpeedZone = lazy(() => import("../SpeedZone"));
const SafetyBubble = lazy(() => import("../SafetyBubble"));
const HalfPlaneHero = lazy(() => import("../HalfPlaneHero"));
const FeasibleZone = lazy(() => import("../FeasibleZone"));
const ParkPlanner = lazy(() => import("../ParkPlanner"));

export const GAMES: GameMeta[] = [
  {
    id: "wristband",
    title: "Wristband Gate",
    short: "Intervals: at least/at most/between & strict vs inclusive.",
    route: "/games/wristband",
    estMinutes: 6,
    difficulty: "intro",
    tags: ["intervals", "inequality symbols"],
    component: WristbandGate,
    icon: <Ruler className="w-5 h-5" />,
  },
  {
    id: "speed-zone",
    title: "Speed Zone Supervisor",
    short: "Basics of inequalities via speed limits. Intervals ↔ inequalities.",
    route: "/games/speed-zone",
    estMinutes: 6,
    difficulty: "intro",
    tags: ["number line", "intervals", "inequalities"],
    component: SpeedZone,
    icon: <Gauge className="w-5 h-5" />,
  },
  {
    id: "half-plane-hero",
    title: "Half-Plane Hero",
    short: "ax + by ≥ c as a shaded half-plane. Drag the neon boundary.",
    route: "/games/half-plane-hero",
    estMinutes: 8,
    difficulty: "core",
    tags: ["linear", "half-plane", "2 variables"],
    component: HalfPlaneHero,
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: "feasible-zone",
    title: "Feasible Zone",
    short: "Systems of inequalities → convex legal zone. Binding vs slack.",
    route: "/games/feasible-zone",
    estMinutes: 10,
    difficulty: "challenge",
    tags: ["systems", "half-planes", "polygon"],
    component: FeasibleZone,
    icon: <Landmark className="w-5 h-5" />,
  },
  {
    id: "park-planner",
    title: "Park Planner",
    short: "ax + by ≥ c as a shaded half-plane. Drag & toggle.",
    route: "/games/park-planner",
    estMinutes: 7,
    difficulty: "core",
    tags: ["half-plane", "slope-intercept", "single inequality"],
    component: ParkPlanner,
    icon: <Trees className="w-5 h-5" />,
  },
  {
    id: "safety-bubble",
    title: "Safety Bubble",
    short: "Absolute value as distance: |x − m| ≥ r.",
    route: "/games/safety-bubble",
    estMinutes: 8,
    difficulty: "core",
    tags: ["absolute value", "distance"],
    component: SafetyBubble,
    icon: <ShieldCheck className="w-5 h-5" />,
  },
];