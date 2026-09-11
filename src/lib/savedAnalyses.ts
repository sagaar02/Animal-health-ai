export interface SavedAnalysis {
  id: string;
  createdAt: Date;
  species: string;
  health: number;
  notes: string;
}

const STORAGE_KEY = 'animal-health-analyses-v1';

export function loadLocalAnalyses(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r): SavedAnalysis | null => {
        if (typeof r !== 'object' || r === null) return null;
        const rec = r as Record<string, unknown>;
        return {
          id: String(rec.id ?? ''),
          createdAt: new Date(String(rec.createdAt ?? new Date().toISOString())),
          species: String(rec.species ?? 'Unknown'),
          health: Number(rec.health ?? 0),
          notes: String(rec.notes ?? ''),
        };
      })
      .filter((r): r is SavedAnalysis => r !== null);
  } catch {
    return [];
  }
}

export function clearLocalAnalyses() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function setLocalAnalyses(records: SavedAnalysis[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* ignore quota */
  }
}

export function deleteLocalAnalysesById(id: string, current: SavedAnalysis[]): SavedAnalysis[] {
  const next = current.filter(l => l.id !== id);
  setLocalAnalyses(next);
  return next;
}
