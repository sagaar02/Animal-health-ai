import { useEffect, useState } from 'react';
import { History, Trash2, CloudOff, RefreshCw, FileText, Loader2 } from 'lucide-react';
import { PanelHeader, StatusPill } from './shared/PanelParts';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SavedAnalysis } from '@/lib/savedAnalyses';
import { clearLocalAnalyses, deleteLocalAnalysesById } from '@/lib/savedAnalyses';

export type { SavedAnalysis };

interface CloudAnalysis {
  id: string;
  created_at: string;
  species: string;
  file_name: string | null;
  overall_health: number | null;
  vet_notes: string | null;
  frame_count: number | null;
  lameness_risk: number | null;
  symmetry: number | null;
}

export default function HistoryPanel({
  local,
  onClear,
  onRestore,
  onSavedChange,
}: {
  local: SavedAnalysis[];
  onClear: () => void;
  onRestore?: (a: SavedAnalysis) => void;
  onSavedChange?: (next: SavedAnalysis[]) => void;
}) {
  const [cloud, setCloud] = useState<CloudAnalysis[] | null>(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [cloudAvailable, setCloudAvailable] = useState(false);

  const refreshCloud = async (showToast = false) => {
    setLoadingCloud(true);
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('id, created_at, species, file_name, overall_health, vet_notes, frame_count, lameness_risk, symmetry')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        setCloudAvailable(false);
        setCloud(null);
        if (showToast) toast.error('Cloud history unavailable: ' + error.message);
        return;
      }
      setCloud(data ?? []);
      setCloudAvailable(true);
      if (showToast) toast.success(`Loaded ${data?.length ?? 0} cloud record(s)`);
    } catch (e) {
      setCloudAvailable(false);
      if (showToast) toast.error(e instanceof Error ? e.message : 'Cloud history unavailable');
    } finally {
      setLoadingCloud(false);
    }
  };

  useEffect(() => {
    void refreshCloud();
  }, []);

  const deleteCloudItem = async (id: string) => {
    try {
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (error) {
        toast.error('Delete failed: ' + error.message);
        return;
      }
      setCloud(prev => prev?.filter(c => c.id !== id) ?? null);
      toast.success('Cloud record deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const deleteLocalItem = (id: string) => {
    const next = deleteLocalAnalysesById(id, local);
    onSavedChange?.(next);
  };

  const totalSaved = local.length + (cloud?.length ?? 0);

  return (
    <section className="panel-section">
      <PanelHeader icon={History} title="Analysis History" meta={totalSaved > 0 ? `${totalSaved} saved` : 'No saves yet'} />
      <div className="space-y-2 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <StatusPill
            label={cloudAvailable ? 'Cloud sync active' : 'Local only'}
            tone={cloudAvailable ? 'active' : 'watch'}
          />
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void refreshCloud(true)}
              disabled={loadingCloud}
              className="h-7 px-2 text-[10px] hover:bg-muted/50"
            >
              {loadingCloud ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
              Refresh
            </Button>
            {local.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm(`Clear all ${local.length} local saved analyses?`)) {
                  clearLocalAnalyses();
                  onClear();
                }
              }}
              className="h-6 px-1.5 text-[10px] hover:bg-muted/50"
            >
<Trash2 className="h-2.5 w-2.5" />
                  Clear local
              </Button>
            )}
          </div>
        </div>

        {!cloudAvailable && (
          <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-[10px] text-muted-foreground">
            <CloudOff className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              Supabase persistence is not yet configured. Analyses save locally to this browser only.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {cloud && cloud.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Cloud History</p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {cloud.map(c => (
                  <li
                    key={c.id}
                    className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-[11px] transition-colors hover:bg-muted/20"
                  >
                    <span className="font-medium text-foreground truncate flex-1">
                      {c.species}
                      {c.file_name && <span className="text-muted-foreground"> · {c.file_name}</span>}
                    </span>
                    <span className="font-mono text-foreground font-semibold bg-muted/30 px-1.5 rounded">{c.overall_health ?? '—'}</span>
                    <button
                      type="button"
                      onClick={() => void deleteCloudItem(c.id)}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      title="Delete cloud record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

                {local.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">Local Session ({local.length})</p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {local.map(l => (
                  <li
                    key={l.id}
                    className="group flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5 text-[11px] transition-colors hover:bg-muted/20"
                  >
                    <span className="font-medium text-foreground truncate flex-1">
                      {l.species}
                    </span>
                    <span className="font-mono text-foreground font-semibold bg-muted/30 px-1.5 rounded">{l.health}</span>
                    {onRestore && (
                      <button
                        type="button"
                        onClick={() => onRestore(l)}
                        className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all"
                        title="Restore notes"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteLocalItem(l.id)}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      title="Delete local record"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {local.length === 0 && (!cloud || cloud.length === 0) && (
          <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
            <History className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-[11px] text-muted-foreground">
              No saved analyses yet.
            </p>
            <p className="text-[10px] text-muted-foreground/70">
              Upload media, run analysis, then click <span className="font-medium text-foreground">Save Analysis</span> to store results here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
