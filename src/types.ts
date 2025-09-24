import type { LazyExoticComponent } from "react";


export type Difficulty = "intro" | "core" | "challenge";


export type GameMeta = {
id: string; // slug (e.g., "wristband")
title: string; // display name
short: string; // one-line description
route: string; // e.g., "/games/wristband"
estMinutes: number; // estimated playtime
difficulty: Difficulty;
tags?: string[];
// Lazy game component (optionally accepts onCleared callback — ignored by older games)
component: LazyExoticComponent<React.ComponentType<{ onCleared?: () => void; onUpdateBest?: (acc: number) => void; }>>;
icon?: React.ReactNode;
};