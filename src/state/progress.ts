import { useEffect, useState } from "react";


export type GameProgress = {
cleared: boolean;
bestAccuracy?: number; // optional metric you can set from games later
playCount: number;
lastPlayed?: string; // ISO date
};


const KEY = "ineq-progress-v1";


export function useProgress() {
const [store, setStore] = useState<Record<string, GameProgress>>(() => {
try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
});


useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch {} }, [store]);


function get(id: string): GameProgress {
return store[id] ?? { cleared: false, playCount: 0 };
}


function markPlayed(id: string) {
setStore(s => ({ ...s, [id]: { ...get(id), playCount: get(id).playCount + 1, lastPlayed: new Date().toISOString() } }));
}


function markCleared(id: string) {
setStore(s => ({ ...s, [id]: { ...get(id), cleared: true, lastPlayed: new Date().toISOString() } }));
}


function updateBestAccuracy(id: string, acc: number) {
const prev = get(id).bestAccuracy ?? 0;
if (acc > prev) setStore(s => ({ ...s, [id]: { ...get(id), bestAccuracy: acc } }));
}


return { get, markPlayed, markCleared, updateBestAccuracy };
}