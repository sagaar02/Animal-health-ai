import type { ChangeEvent } from 'react';
import { Clock3, FileImage, Gauge, Upload, Workflow } from 'lucide-react';
import { PanelHeader, MetricTile, formatDuration, type UploadPanelProps } from './shared/PanelParts';
import type { AnimalProfile } from '@/lib/adaptivePose';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const SPECIES_OPTIONS = [
  { value: 'Dog', label: 'Dog (Canine)' },
  { value: 'Cat', label: 'Cat (Feline)' },
  { value: 'Horse', label: 'Horse (Equine)' },
  { value: 'Cow', label: 'Cow (Bovine)' },
  { value: 'Goat', label: 'Goat (Caprine)' },
  { value: 'Sheep', label: 'Sheep (Ovine)' },
  { value: 'Pig', label: 'Pig (Swine)' },
  { value: 'Deer', label: 'Deer' },
  { value: 'Camel', label: 'Camel' },
  { value: 'Llama', label: 'Llama' },
  { value: 'Alpaca', label: 'Alpaca' },
  { value: 'Rabbit', label: 'Rabbit' },
  { value: 'Fox', label: 'Fox' },
  { value: 'Wolf', label: 'Wolf' },
  { value: 'Lion', label: 'Lion' },
  { value: 'Tiger', label: 'Tiger' },
  { value: 'Zebra', label: 'Zebra' },
  { value: 'Elephant', label: 'Elephant' },
  { value: 'Rhino', label: 'Rhinoceros' },
  { value: 'Bird', label: 'Bird (Avian)' },
  { value: 'Chicken', label: 'Chicken' },
  { value: 'Duck', label: 'Duck' },
  { value: 'Eagle', label: 'Eagle' },
  { value: 'Parrot', label: 'Parrot' },
  { value: 'Snake', label: 'Snake / Reptile' },
  { value: 'Kangaroo', label: 'Kangaroo' },
  { value: 'Monkey', label: 'Primate / Monkey' },
  { value: 'Fish', label: 'Fish / Aquatic' },
  { value: 'Unspecified', label: 'Unspecified / Other' },
];

export default function UploadPanel({
  fileName,
  videoUrl,
  profile,
  videoInfo,
  onUpload,
  onSpeciesOverride,
}: UploadPanelProps) {
  return (
    <section className="panel-section">
      <PanelHeader icon={Upload} title="Media Upload" meta="Clinical input" />
      <div className="space-y-2 p-2.5">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/10 px-3 py-3 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5">
          <input className="hidden" type="file" accept="video/*,image/*" onChange={onUpload} />
          <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border/60">
            <FileImage className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold text-foreground">{videoUrl ? 'Replace media' : 'Upload animal media'}</span>
          <span className="mt-0.5 max-w-[200px] text-[10px] leading-4 text-muted-foreground">
            MP4, JPG, PNG, WebM
          </span>
        </label>

        <div className="space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Case file</p>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">{fileName || 'No video selected'}</p>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <MetricTile icon={Clock3} label="Duration" value={videoInfo ? formatDuration(videoInfo.duration) : '--'} />
            <MetricTile icon={Gauge} label="Resolution" value={videoInfo ? `${videoInfo.width}×${videoInfo.height}` : '--'} />
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg border border-border/60 bg-background/50 p-2">
          <div className="flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5 text-primary" />
            <p className="text-[11px] font-semibold text-foreground">Model routing</p>
          </div>

          <div className="space-y-1.5">
            <div>
              <Label className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-0.5 block">
                Species
              </Label>
              <Select
                value={profile?.species ?? ''}
                onValueChange={onSpeciesOverride}
              >
                <SelectTrigger className="w-full text-[11px] h-8">
                  <SelectValue placeholder={profile?.species ?? 'Auto-detect'} />
                </SelectTrigger>
                <SelectContent>
                  {SPECIES_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Anatomy</span>
              <span className="font-medium text-foreground">{profile?.anatomyClass ?? '--'}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>Fit</span>
              <span className="font-mono font-medium text-foreground">
                {profile ? `${Math.round(profile.confidence * 100)}%` : '--'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/10 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Description</p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">
            {profile ? `${profile.species} — ${profile.conditionLabel}` : 'Awaiting video'}
          </p>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
            {profile
              ? profile.clinicalHint
              : 'Upload a video to detect the animal and describe movement.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export type { AnimalProfile };
