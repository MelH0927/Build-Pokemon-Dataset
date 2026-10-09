'use client';

import React, { useEffect, useMemo, useState } from 'react';

/**
 * Pokemon Type Quiz – React + Tailwind (single-file component)
 *
 * Fixes in this version
 * - Hides the answer until after submission
 * - Compact 3-letter type labels on buttons (full name as tooltip)
 * - JSONL loader regex fixed (no multiline break)
 * - Local file support: set DATA_PATH = "/standard.jsonl" to use Next.js public file
 * - Randomly samples 10 entries per run + Reshuffle button
 */

/** ========================
 *  🔧 Configuration
 *  ======================== */
const HF_REPO = 'andyqmongo/pokemon-newer-dataset'; // optional if reading local data
// Only needed when DATA_PATH points at a private HF repo. NEXT_PUBLIC_* vars are
// bundled into client JS, so leave unset when loading data from public/.
const HF_TOKEN = process.env.NEXT_PUBLIC_HF_TOKEN ?? '';
const DATA_PATH = '/standard_all.jsonl'; // local public file OR repo path like 'standard.jsonl'
const ITEMS_PER_PAGE = 40; // items per page

/** ========================
 *  🎨 Type Colors (ignore Stellar)
 *  ======================== */
const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

const ALL_TYPES = Object.keys(TYPE_COLORS) as (keyof typeof TYPE_COLORS)[];

// Full names for tooltip
const TYPE_LABELS: Record<string, string> = {
  normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric', grass: 'Grass', ice: 'Ice',
  fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug',
  rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy',
};

// Short labels so buttons fit nicely; full name appears on hover via title
const TYPE_ABBR: Record<string, string> = {
  normal: '一般', fire: '火', water: '水', electric: '電', grass: '草', ice: '冰',
  fighting: '格鬥', poison: '毒', ground: '地面', flying: '飛行', psychic: '超能力', bug: '昆蟲',
  rock: '岩石', ghost: '幽靈', dragon: '龍', dark: '惡', steel: '鋼', fairy: '妖精',
};

/** Dataset entry shape */
type Entry = {
  image: string; // absolute URL, repo-relative path, or local '/quiz_images/...'
  primary_type: string;
  secondary_type?: string | null;
  art_style: string;
  name: string;
  paradox_or_ultrabeast?: string;
};

/** Helpers to build a data URL */
function resolveDataUrl(path: string) {
  if (path.startsWith("/") || /^https?:\/\//i.test(path)) return path; // local or absolute URL
  return `https://huggingface.co/datasets/${HF_REPO}/resolve/main/${encodeURI(path)}`;
}

/** Normalize type strings */
function normType(t?: string | null): keyof typeof TYPE_COLORS | 'none' {
  if (!t) return 'none';
  const s = String(t).trim().toLowerCase();
  if (s === 'n/a' || s === 'null' || s === 'none' || s === '') return 'none';
  return (s as keyof typeof TYPE_COLORS) in TYPE_COLORS ? (s as keyof typeof TYPE_COLORS) : 'none';
}

/** Fetch JSON/JSONL with optional Authorization */
async function fetchDatasetFile(path: string, token?: string): Promise<Entry[]> {
  const url = resolveDataUrl(path);
  const needsAuth = url.includes("huggingface.co/datasets/");
  const res = await fetch(url, {
    headers: needsAuth && token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status} ${res.statusText}`);

  const text = await res.text();
  const trimmed = text.trim();

  // JSON array
  if (trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as Entry[];
  }

  // JSONL
  const lines = trimmed.split(/\r?\n/); // <-- must stay on one line
  const out: Entry[] = [];
  for (const ln of lines) {
    if (!ln) continue;
    try {
      out.push(JSON.parse(ln));
    } catch {
      // skip bad line
    }
  }
  return out;
}

/** Load image with Authorization when needed; supports local '/...' paths */
function useImageWithAuth(imagePathOrUrl: string, token?: string) {
  const [src, setSrc] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let revoked = false; let objectUrl: string | null = null;
    (async () => {
      try {
        setError('');
        const isLocal = imagePathOrUrl.startsWith('/');
        const isAbsolute = /^https?:\/\//i.test(imagePathOrUrl);

        if (isLocal) { setSrc(imagePathOrUrl); return; }
        if (isAbsolute && !token) { setSrc(imagePathOrUrl); return; }

        const finalUrl = isAbsolute ? imagePathOrUrl : `https://huggingface.co/datasets/${HF_REPO}/resolve/main/${encodeURI(imagePathOrUrl)}`;
        const resp = await fetch(finalUrl, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
        const blob = await resp.blob(); objectUrl = URL.createObjectURL(blob);
        if (!revoked) setSrc(objectUrl);
      } catch (e: unknown) { 
        setError(e instanceof Error ? e.message : String(e)); 
      }
    })();
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [imagePathOrUrl, token]);

  return { src, error } as const;
}

/** Type button */
function TypeButton({
  type,
  label,
  selected,
  onClick,
  disabled,
}: {
  type: keyof typeof TYPE_COLORS;
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const color = TYPE_COLORS[type];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={TYPE_LABELS[type]}
      className={`text-white rounded-xl px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow transition border will-change-transform flex items-center justify-center
        ${selected ? 'translate-y-[1px] brightness-90 shadow-inner ring-2 ring-white/70' : 'ring-0 active:translate-y-[1px] active:brightness-90'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
      style={{ backgroundColor: color, borderColor: 'rgba(0,0,0,0.15)' }}
    >
      {label}
    </button>
  );
}

/** Score a single answer */
function scoreAnswer(userSel: string[], primary: string, secondary?: string | null): { score: number; label: 'correct' | 'wrong' } {
  const p = normType(primary);
  const s = normType(secondary);
  const picks = [...new Set(userSel.map((x) => normType(x)).filter((t) => t !== 'none'))];
  if (picks.length === 0) return { score: 0, label: 'wrong' };
  if (s === 'none') {
    if (picks.length > 1) return { score: 0, label: 'wrong' };
    if (!picks.includes(p)) return { score: 0, label: 'wrong' };
    return { score: 1, label: 'correct' };
  }
  if (picks.length === 1) {
    if (!picks.includes(p) && !picks.includes(s)) return { score: 0, label: 'wrong' };
    return { score: 1, label: 'correct' };
  }
  if (picks.length === 2) {
    if (!picks.includes(p) || !picks.includes(s)) return { score: 0, label: 'wrong' };
    return { score: 1, label: 'correct' };
  }
  else {
    return { score: 0, label: 'wrong' };
  }
}

/** Card for one Pokémon */
function PokemonCard({ entry, token, onSubmit, locked, submitted }: { entry: Entry; token?: string; onSubmit: (payload: { id: string; picks: string[]; result: ReturnType<typeof scoreAnswer> }) => void; locked?: boolean; submitted?: ReturnType<typeof scoreAnswer> & { picks: string[] }; }) {
  const { name, image, primary_type, secondary_type } = entry;
  const [selected, setSelected] = useState<string[]>([]);
  const { src, error } = useImageWithAuth(image, token);
  const isLocked = !!locked;

  const toggle = (t: string) => {
    if (isLocked) return;
    const already = selected.includes(t);
    if (already) setSelected(selected.filter((x) => x !== t));
    else { if (selected.length >= 2) return; setSelected([...selected, t]); }
  };

  const canSubmit = selected.length >= 1 && selected.length <= 2 && !isLocked;

  return (
    <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3 border">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{name}</h3>
        {submitted && (
          <div className={`rounded-xl text-xs font-semibold px-2 py-1 shadow border ${submitted.label === 'correct' ? 'bg-green-500 text-white border-green-600' : ''} ${submitted.label === 'wrong' ? 'bg-red-500 text-white border-red-600' : ''}`}>
            {submitted.label.toUpperCase()} ({submitted.score})
          </div>
        )}
        {isLocked && (
          <div className="text-[11px] text-gray-500">
            Answer: {primary_type}
            {normType(secondary_type) !== 'none' ? ` / ${secondary_type}` : ''}
          </div>
        )}
      </div>

      <div className="w-full aspect-square bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border">
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-contain" />
        ) : error ? (
          <div className="text-red-600 text-sm p-4">Failed to load image: {error}</div>
        ) : (
          <div className="text-gray-400 text-sm">Loading image…</div>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {ALL_TYPES.map((t) => (
          <TypeButton
            key={t}
            type={t}
            label={TYPE_ABBR[t]}
            selected={selected.includes(t)}
            onClick={() => toggle(t)}
            disabled={isLocked}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-gray-500">Choose 1–2 types</div>
        <button
          onClick={() => { const result = scoreAnswer(selected, primary_type, secondary_type); onSubmit({ id: name, picks: selected, result }); }}
          disabled={!canSubmit}
          className={`px-4 py-2 rounded-xl text-white shadow transition active:scale-95 ${canSubmit ? 'bg-black hover:opacity-90' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

/** Main quiz */
export default function PokemonTypeQuiz() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [results, setResults] = useState<Record<string, ReturnType<typeof scoreAnswer> & { picks: string[] }>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const standardEntries = useMemo(() => entries.filter((e) => String(e.art_style).trim().toLowerCase() === 'standard'), [entries]);

  const totalPages = Math.ceil(standardEntries.length / ITEMS_PER_PAGE);
  
  const currentPageEntries = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    return standardEntries.slice(startIdx, endIdx);
  }, [standardEntries, currentPage]);

  const totalAttempted = Object.keys(results).length;
  const totalScore = Object.values(results).reduce((acc, r) => acc + r.score, 0);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setError('');
        const data = await fetchDatasetFile(DATA_PATH, HF_TOKEN || undefined);
        const cleaned: Entry[] = data.map((d: Record<string, unknown>) => ({
          image: d.image as string,
          primary_type: String(d.primary_type || '').toLowerCase(),
          secondary_type: d.secondary_type as string | null ?? null,
          art_style: String(d.art_style || '').toLowerCase(),
          name: String(d.name || 'Unknown'),
          paradox_or_ultrabeast: d.paradox_or_ultrabeast as string ?? undefined,
        }));
        setEntries(cleaned);
      } catch (e: unknown) { 
        setError(e instanceof Error ? e.message : String(e)); 
      }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        <header className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Pokémon Type Quiz</h1>
          <div className="flex items-center gap-3">
            <div className="bg-white border rounded-xl px-3 py-2 shadow text-sm">
              <div className="font-medium">Score</div>
              <div className="text-gray-700">{totalScore.toFixed(1)} pt</div>
            </div>
            <div className="bg-white border rounded-xl px-3 py-2 shadow text-sm">
              <div className="font-medium">Attempted</div>
              <div className="text-gray-700">{totalAttempted} / {currentPageEntries.length}</div>
            </div>
            <div className="bg-white border rounded-xl px-3 py-2 shadow text-sm">
              <div className="font-medium">Page</div>
              <div className="text-gray-700">{currentPage} / {totalPages}</div>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">
            Choose 1–2 types per Pokémon. Any match = <b>1 pt</b>, no match = <b>0 pt</b>.
          </p>
          
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-gray-900 text-white shadow hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-gray-900 text-white shadow hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        </div>

        {loading && (<div className="text-gray-600">Loading dataset…</div>)}
        {error && (<div className="text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl mb-4 whitespace-pre-wrap">{error}</div>)}
        {!loading && !error && currentPageEntries.length === 0 && (<div className="text-gray-500">No entries with art_style = &quot;standard&quot; found.</div>)}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentPageEntries.map((e: Entry) => {
            const id = e.name;
            const submitted = results[id];
            return (
              <div key={id} className="relative">
                <PokemonCard
                  entry={e}
                  token={HF_TOKEN || undefined}
                  locked={!!submitted}
                  submitted={submitted}
                  onSubmit={({ id, picks, result }) => setResults((prev) => ({ ...prev, [id]: { ...result, picks } }))}
                />
              </div>
            );
          })}
        </div>

        {/* Additional pagination controls at bottom */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              className="px-4 py-2 rounded-xl bg-gray-900 text-white shadow hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Previous Page
            </button>
            
            <div className="flex items-center gap-2">
              {/* Show page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    className={`w-10 h-10 rounded-lg border font-medium transition ${
                      pageNum === currentPage
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              className="px-4 py-2 rounded-xl bg-gray-900 text-white shadow hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next Page →
            </button>
          </div>
        )}

        <footer className="mt-10 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <p>Set <code>DATA_PATH</code> to <code>&quot;/standard.jsonl&quot;</code> for a local file in <code>public/</code>, or to a path within your HF repo. If you see <code>404</code> from HF, double-check the path and token.</p>
            <p className="text-right">
              Total Pokémon: <strong>{standardEntries.length}</strong><br />
              Showing: {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, standardEntries.length)}
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
