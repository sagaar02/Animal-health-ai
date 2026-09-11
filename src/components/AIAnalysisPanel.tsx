import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, AlertCircle, CheckCircle, XCircle, Stethoscope, Eye, Shield, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export interface AIHealthScores {
  overallHealth: number;
  lamenessScore: number;
  movementAnomaly: number;
  stepSymmetry: number;
  strideConsistency: number;
  bodyConditionScore: number; // 1-9 scale (BCS) or 1-5 (species-specific)
  vetNotes: string;
}

export interface AnimalAnalysis {
  animalType: string;
  confidence: number;
  appearance: {
    bodyCondition?: string;
    coatCondition?: string;
    posture?: string;
    overallAppearance?: string;
  };
  healthAssessment: {
    overallStatus: string;
    possibleIssues?: string[];
    painIndicators?: string[];
    mobilityAssessment?: string;
  };
  injuryAnalysis: {
    visibleInjuries?: string[];
    suspectedInjuries?: string[];
    affectedAreas?: string[];
    severity: string;
  };
  healthScores: AIHealthScores;
  recommendations?: string[];
  summary: string;
  vetNotes: string;
}

interface Props {
  imageDataUrl: string | null;
  poseData: unknown;
  onHealthScores?: (scores: AIHealthScores) => void;
}

const statusColors: Record<string, string> = {
  healthy: 'text-success',
  'mild concern': 'text-warning',
  'moderate concern': 'text-warning',
  urgent: 'text-destructive',
  unknown: 'text-muted-foreground',
};

const severityColors: Record<string, string> = {
  none: 'text-success',
  mild: 'text-warning',
  moderate: 'text-warning',
  severe: 'text-destructive',
  unknown: 'text-muted-foreground',
};

const statusIcons: Record<string, React.ElementType> = {
  healthy: CheckCircle,
  'mild concern': AlertCircle,
  'moderate concern': AlertCircle,
  urgent: XCircle,
};

export default function AIAnalysisPanel({ imageDataUrl, poseData, onHealthScores }: Props) {
  const [analysis, setAnalysis] = useState<AnimalAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!imageDataUrl) {
      toast.error('Please upload an image or capture from webcam first');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      console.log('[AIAnalysisPanel] Invoking analyze-animal edge function', {
        imageBytes: imageDataUrl.length,
        hasPose: !!poseData,
      });

      const { data, error: fnError } = await supabase.functions.invoke('analyze-animal', {
        body: { imageBase64: imageDataUrl, poseData },
      });

      console.log('[AIAnalysisPanel] Edge function response', { data, fnError });

      if (fnError) {
        const detail = (fnError as { context?: { status?: number; body?: unknown } }).context;
        const status = detail?.status;
        const body = detail?.body;
        const extra = status ? ` [HTTP ${status}]` : '';
        const bodyStr = body ? ` - ${typeof body === 'string' ? body : JSON.stringify(body)}` : '';
        throw new Error(`${fnError.message}${extra}${bodyStr}`);
      }
      if (!data) {
        throw new Error('No response from edge function. Make sure the "analyze-animal" function is deployed in your Supabase project.');
      }
      if (data?.error) throw new Error(data.error);
      if (data?.analysis) {
        setAnalysis(data.analysis);
        if (data.analysis.healthScores && onHealthScores) {
          const scores = { ...data.analysis.healthScores };
          if (!scores.vetNotes && typeof data.analysis.vetNotes === 'string') {
            scores.vetNotes = data.analysis.vetNotes;
          }
          onHealthScores(scores);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Analysis failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const status = analysis?.healthAssessment?.overallStatus || 'unknown';
  const StatusIcon = statusIcons[status] || AlertCircle;

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={analyze}
        disabled={loading || !imageDataUrl}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all glow-primary"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analyzing with AI…
          </>
        ) : (
          <>
            <Brain className="w-3.5 h-3.5" />
            Run Deep Analysis
          </>
        )}
      </button>

      {!imageDataUrl && !analysis && (
        <div className="flex min-h-[100px] flex-col items-center justify-center rounded-lg border border-border/60 bg-muted/10 p-4 text-center">
          <Brain className="mb-2 h-6 w-6 text-muted-foreground/30" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Upload media and capture a frame<br/>to run the vision AI.
          </p>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-[11px] font-medium leading-relaxed">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {analysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-3"
          >
            {/* Animal ID */}
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.14em]">Identified Animal</span>
                <span className="text-[10px] font-mono text-primary font-semibold">{analysis.confidence}% confidence</span>
              </div>
              <h3 className="text-sm font-bold text-primary">{analysis.animalType}</h3>
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Health Status */}
            <div className="p-3 rounded-lg border border-border/60 bg-background/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.14em]">Health Assessment</span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <StatusIcon className={`w-4 h-4 ${statusColors[status]}`} />
                <span className={`text-sm font-bold capitalize ${statusColors[status]}`}>
                  {status}
                </span>
              </div>
              {analysis.healthAssessment.mobilityAssessment && (
                <div className="text-[10px] text-muted-foreground mb-2 leading-relaxed">
                  <span className="font-semibold text-foreground">Mobility:</span> {analysis.healthAssessment.mobilityAssessment}
                </div>
              )}
              {analysis.healthAssessment.possibleIssues && analysis.healthAssessment.possibleIssues.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-border/60">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Possible Issues</span>
                  <ul className="space-y-1">
                    {analysis.healthAssessment.possibleIssues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[10px] text-warning leading-relaxed">
                        <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-70" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.healthAssessment.painIndicators && analysis.healthAssessment.painIndicators.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-border/60">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 block">Pain Indicators</span>
                  <ul className="space-y-1">
                    {analysis.healthAssessment.painIndicators.map((p, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[10px] text-destructive leading-relaxed">
                        <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-70" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Appearance */}
            <div className="p-3 rounded-lg border border-border/60 bg-background/50">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.14em]">Appearance</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {analysis.appearance.bodyCondition && (
                  <div className="p-2 rounded-md bg-muted/10 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] font-mono uppercase mb-0.5">Body</span>
                    <span className="font-semibold capitalize text-foreground">{analysis.appearance.bodyCondition}</span>
                  </div>
                )}
                {analysis.appearance.bodyCondition && analysis.healthScores.bodyConditionScore !== undefined && (
                  <div className="p-2 rounded-md bg-muted/10 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] font-mono uppercase mb-0.5">BCS Score</span>
                    <span className="font-mono font-bold text-primary">
                      {analysis.healthScores.bodyConditionScore}/9
                    </span>
                  </div>
                )}
                {analysis.appearance.coatCondition && (
                  <div className="p-2 rounded-md bg-muted/10 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] font-mono uppercase mb-0.5">Coat</span>
                    <span className="font-semibold capitalize text-foreground">{analysis.appearance.coatCondition}</span>
                  </div>
                )}
                {analysis.appearance.posture && (
                  <div className="p-2 rounded-md bg-muted/10 border border-border/60">
                    <span className="text-muted-foreground block text-[9px] font-mono uppercase mb-0.5">Posture</span>
                    <span className="font-semibold capitalize text-foreground">{analysis.appearance.posture}</span>
                  </div>
                )}
              </div>
              {(analysis.vetNotes || analysis.healthScores.vetNotes) && (
                <div className="mt-2.5 p-2.5 rounded-md border border-border/60 bg-muted/5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Stethoscope className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Veterinary Notes</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed italic border-l-2 border-primary/30 pl-2">
                    "{analysis.vetNotes || analysis.healthScores.vetNotes}"
                  </p>
                </div>
              )}
              {analysis.appearance.overallAppearance && (
                <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{analysis.appearance.overallAppearance}</p>
              )}
            </div>

            {/* Injury Analysis */}
            <div className="p-3 rounded-lg border border-border/60 bg-background/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.14em]">Injury Analysis</span>
                </div>
                <span className={`text-[10px] font-mono font-bold capitalize bg-background px-1.5 py-0.5 rounded border border-border/40 ${severityColors[analysis.injuryAnalysis.severity]}`}>
                  {analysis.injuryAnalysis.severity} severity
                </span>
              </div>
              
              <div className="space-y-2">
                {analysis.injuryAnalysis.visibleInjuries && analysis.injuryAnalysis.visibleInjuries.length > 0 && (
                  <div>
                    <span className="text-[9px] font-mono text-destructive uppercase tracking-widest mb-1 block">Visible Injuries</span>
                    <ul className="space-y-1">
                      {analysis.injuryAnalysis.visibleInjuries.map((inj, i) => (
                        <li key={i} className="text-[10px] text-destructive flex items-start gap-1.5 leading-relaxed">
                          <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-70" /> {inj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.injuryAnalysis.suspectedInjuries && analysis.injuryAnalysis.suspectedInjuries.length > 0 && (
                  <div>
                    <span className="text-[9px] font-mono text-warning uppercase tracking-widest mb-1 block">Suspected Injuries</span>
                    <ul className="space-y-1">
                      {analysis.injuryAnalysis.suspectedInjuries.map((inj, i) => (
                        <li key={i} className="text-[10px] text-warning flex items-start gap-1.5 leading-relaxed">
                          <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0 opacity-70" /> {inj}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(!analysis.injuryAnalysis.visibleInjuries?.length && !analysis.injuryAnalysis.suspectedInjuries?.length) && (
                  <div className="flex items-center gap-1.5 text-[10px] text-success font-medium bg-success/10 border border-success/20 p-2 rounded-md">
                    <CheckCircle className="w-3 h-3" /> No injuries detected
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <span className="text-[10px] font-mono text-primary uppercase tracking-[0.14em] font-bold mb-2 block">Recommendations</span>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[10px] text-foreground leading-relaxed">
                      <span className="w-4 h-4 rounded bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-[9px] font-bold font-mono">
                        {i + 1}
                      </span>
                      <span className="mt-0.5">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
