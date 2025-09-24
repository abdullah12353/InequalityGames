// Template for new games — accepts optional onCleared callback
export default function NewGameTemplate({ onCleared }: { onCleared?: () => void }) {
return (
<div className="p-6">
<h2 className="text-xl font-semibold">Game Name</h2>
<p className="text-slate-600">Brief description.</p>
{/* …your game… */}
<button className="mt-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2" onClick={()=> onCleared?.()}>Mark Complete</button>
</div>
);
}