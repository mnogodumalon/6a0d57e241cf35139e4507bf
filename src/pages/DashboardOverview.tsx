import { useDashboardData } from '@/hooks/useDashboardData';
import type { Aenderungsvorschlag } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AenderungsvorschlagDialog } from '@/components/dialogs/AenderungsvorschlagDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconClipboardList,
  IconHourglass,
  IconSettings,
  IconCircleCheck,
  IconX,
  IconAlertTriangle,
  IconUser,
  IconCalendar,
  IconTag,
  IconFileDescription,
  IconExternalLink,
  IconDownload,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0d57e241cf35139e4507bf';
const REPAIR_ENDPOINT = '/claude/build/repair';

const COLUMNS: { key: string; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: 'offen',          label: 'Offen',          color: 'text-blue-600',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200' },
  { key: 'in_pruefung',    label: 'In Prüfung',     color: 'text-amber-600',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', color: 'text-violet-600', bgColor: 'bg-violet-50',  borderColor: 'border-violet-200' },
  { key: 'umgesetzt',      label: 'Umgesetzt',      color: 'text-emerald-600',bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  { key: 'abgelehnt',      label: 'Abgelehnt',      color: 'text-red-600',    bgColor: 'bg-red-50',     borderColor: 'border-red-200' },
  { key: 'zurueckgestellt',label: 'Zurückgestellt', color: 'text-slate-600',  bgColor: 'bg-slate-50',   borderColor: 'border-slate-200' },
];

const PRIORITAET_COLORS: Record<string, string> = {
  kritisch: 'bg-red-100 text-red-700 border-red-200',
  hoch:     'bg-orange-100 text-orange-700 border-orange-200',
  mittel:   'bg-amber-100 text-amber-700 border-amber-200',
  niedrig:  'bg-slate-100 text-slate-600 border-slate-200',
};

const KATEGORIE_ICONS: Record<string, React.ReactNode> = {
  benutzeroberflaeche: <IconTag size={12} className="shrink-0" />,
  funktionalitaet:     <IconSettings size={12} className="shrink-0" />,
  performance:         <IconHourglass size={12} className="shrink-0" />,
  sicherheit:          <IconAlertTriangle size={12} className="shrink-0" />,
  barrierefreiheit:    <IconCircleCheck size={12} className="shrink-0" />,
  sonstiges:           <IconTag size={12} className="shrink-0" />,
};

function isImageUrl(url: string) {
  // Check explicit extension OR common image content-type hints in URL
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(url) ||
    /[?&](type|mime|content.?type)=image/i.test(url);
}

export default function DashboardOverview() {
  const { aenderungsvorschlag, loading, error, fetchAll } = useDashboardData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Aenderungsvorschlag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Aenderungsvorschlag | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailRecord, setDetailRecord] = useState<Aenderungsvorschlag | null>(null);

  const stats = useMemo(() => {
    const total = aenderungsvorschlag.length;
    const offen = aenderungsvorschlag.filter(a => a.fields.status?.key === 'offen').length;
    const inBearbeitung = aenderungsvorschlag.filter(a =>
      a.fields.status?.key === 'in_pruefung' || a.fields.status?.key === 'in_bearbeitung'
    ).length;
    const umgesetzt = aenderungsvorschlag.filter(a => a.fields.status?.key === 'umgesetzt').length;
    const kritisch = aenderungsvorschlag.filter(a => a.fields.prioritaet?.key === 'kritisch').length;
    return { total, offen, inBearbeitung, umgesetzt, kritisch };
  }, [aenderungsvorschlag]);

  const grouped = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = aenderungsvorschlag.filter(a => {
      if (statusFilter && a.fields.status?.key !== statusFilter) return false;
      if (q) {
        const haystack = [
          a.fields.titel,
          a.fields.beschreibung,
          a.fields.betroffener_bereich,
          a.fields.einreicher_vorname,
          a.fields.einreicher_nachname,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    const map: Record<string, Aenderungsvorschlag[]> = {};
    for (const col of COLUMNS) map[col.key] = [];
    for (const a of filtered) {
      const key = a.fields.status?.key ?? 'offen';
      if (map[key]) map[key].push(a);
      else map['offen'].push(a);
    }
    return map;
  }, [aenderungsvorschlag, statusFilter, searchQuery]);

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const handleCreate = async (fields: Aenderungsvorschlag['fields']) => {
    await LivingAppsService.createAenderungsvorschlagEntry(fields);
    fetchAll();
  };

  const handleEdit = async (fields: Aenderungsvorschlag['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateAenderungsvorschlagEntry(editRecord.record_id, fields);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteAenderungsvorschlagEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  const handleStatusChange = async (record: Aenderungsvorschlag, newStatus: string) => {
    await LivingAppsService.updateAenderungsvorschlagEntry(record.record_id, { status: newStatus as any });
    fetchAll();
  };

  const activeColumns = statusFilter
    ? COLUMNS.filter(c => c.key === statusFilter)
    : COLUMNS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Änderungsvorschläge</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Verwalte und bearbeite Verbesserungsvorschläge</p>
        </div>
        <Button onClick={() => { setEditRecord(null); setDialogOpen(true); }} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Neuer Vorschlag
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Gesamt"
          value={String(stats.total)}
          description="Alle Vorschläge"
          icon={<IconClipboardList size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen"
          value={String(stats.offen)}
          description="Warten auf Prüfung"
          icon={<IconHourglass size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="In Arbeit"
          value={String(stats.inBearbeitung)}
          description="In Prüfung oder Bearbeitung"
          icon={<IconSettings size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Umgesetzt"
          value={String(stats.umgesetzt)}
          description="Erfolgreich abgeschlossen"
          icon={<IconCircleCheck size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Kritisch Banner */}
      {stats.kritisch > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          <IconAlertTriangle size={16} className="shrink-0" />
          <span>{stats.kritisch} kritische{stats.kritisch === 1 ? 'r' : ''} Vorschlag{stats.kritisch > 1 ? 'e' : ''} – sofortiger Handlungsbedarf</span>
        </div>
      )}

      {/* Search + Status Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Suchen..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-56 min-w-0"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-accent'
            }`}
          >
            Alle
          </button>
          {COLUMNS.map(col => (
            <button
              key={col.key}
              onClick={() => setStatusFilter(statusFilter === col.key ? null : col.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === col.key
                  ? `${col.bgColor} ${col.color} ${col.borderColor}`
                  : 'bg-background text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {col.label}
              <span className="ml-1.5 opacity-70">({grouped[col.key]?.length ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div
          className="flex gap-4 min-w-0"
          style={{ minWidth: activeColumns.length > 3 ? `${activeColumns.length * 280}px` : undefined }}
        >
          {activeColumns.map(col => {
            const cards = grouped[col.key] ?? [];
            return (
              <div key={col.key} className="flex-1 min-w-[260px] flex flex-col gap-3">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${col.bgColor} border ${col.borderColor}`}>
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bgColor} ${col.color} border ${col.borderColor}`}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {cards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-border text-muted-foreground text-xs">
                      <IconClipboardList size={24} stroke={1.5} className="mb-1 opacity-40" />
                      <span>Keine Einträge</span>
                    </div>
                  ) : (
                    cards.map(card => (
                      <KanbanCard
                        key={card.record_id}
                        record={card}
                        colColor={col.color}
                        onEdit={() => { setEditRecord(card); setDialogOpen(true); }}
                        onDelete={() => setDeleteTarget(card)}
                        onStatusChange={handleStatusChange}
                        onDetail={() => setDetailRecord(card)}
                      />
                    ))
                  )}
                </div>

                {/* Add to column */}
                <button
                  onClick={() => {
                    setEditRecord(null);
                    setDialogOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-border text-muted-foreground text-xs hover:border-primary hover:text-primary transition-colors"
                >
                  <IconPlus size={14} className="shrink-0" />
                  Vorschlag hinzufügen
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialogs */}
      <AenderungsvorschlagDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={editRecord ? handleEdit : handleCreate}
        defaultValues={editRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Aenderungsvorschlag']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Aenderungsvorschlag']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Vorschlag löschen"
        description={`Möchtest du „${deleteTarget?.fields.titel ?? 'diesen Vorschlag'}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Detail Overlay */}
      {detailRecord && (
        <DetailOverlay
          record={detailRecord}
          onClose={() => setDetailRecord(null)}
          onEdit={() => { setEditRecord(detailRecord); setDetailRecord(null); setDialogOpen(true); }}
          onDelete={() => { setDeleteTarget(detailRecord); setDetailRecord(null); }}
        />
      )}
    </div>
  );
}

// --- Detail Overlay ---

interface DetailOverlayProps {
  record: Aenderungsvorschlag;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function DetailOverlay({ record, onClose, onEdit, onDelete }: DetailOverlayProps) {
  const { fields } = record;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const col = COLUMNS.find(c => c.key === (fields.status?.key ?? 'offen')) ?? COLUMNS[0];
  const prioritaetKey = fields.prioritaet?.key ?? '';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-border ${col.bgColor}`}>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${col.bgColor} ${col.color} ${col.borderColor}`}>
                {col.label}
              </span>
              {prioritaetKey && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITAET_COLORS[prioritaetKey] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                  {prioritaetKey === 'kritisch' && <IconAlertTriangle size={10} className="inline mr-0.5 shrink-0" />}
                  {fields.prioritaet?.label}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-foreground leading-snug">
              {fields.titel ?? '(Kein Titel)'}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              title="Bearbeiten"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <IconPencil size={15} className="shrink-0" />
            </button>
            <button
              onClick={onDelete}
              title="Löschen"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <IconTrash size={15} className="shrink-0" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <IconX size={15} className="shrink-0" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Beschreibung */}
          {fields.beschreibung && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Beschreibung</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{fields.beschreibung}</p>
            </section>
          )}

          {/* Betroffener Bereich */}
          {fields.betroffener_bereich && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Betroffener Bereich</h3>
              <p className="text-sm text-foreground">{fields.betroffener_bereich}</p>
            </section>
          )}

          {/* Kategorie */}
          {fields.kategorie && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Kategorie</h3>
              <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                {KATEGORIE_ICONS[fields.kategorie.key]}
                {fields.kategorie.label}
              </span>
            </section>
          )}

          {/* Screenshots / Anhänge */}
          {fields.screenshots && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Screenshots &amp; Anhänge</h3>
              <FilePreview url={fields.screenshots} onOpen={setLightboxUrl} />
            </section>
          )}

          {/* Einreicher */}
          {(fields.einreicher_vorname || fields.einreicher_nachname || fields.einreicher_email) && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Eingereicht von</h3>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <IconUser size={14} className="shrink-0 text-muted-foreground" />
                <span>{[fields.einreicher_vorname, fields.einreicher_nachname].filter(Boolean).join(' ')}</span>
              </div>
              {fields.einreicher_email && (
                <a
                  href={`mailto:${fields.einreicher_email}`}
                  className="text-xs text-primary hover:underline mt-0.5 block ml-5"
                >
                  {fields.einreicher_email}
                </a>
              )}
            </section>
          )}

          {/* Einreichungsdatum */}
          {fields.einreichungsdatum && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Einreichungsdatum</h3>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <IconCalendar size={14} className="shrink-0 text-muted-foreground" />
                <span>{formatDate(fields.einreichungsdatum)}</span>
              </div>
            </section>
          )}

          {/* Bearbeiter */}
          {(fields.bearbeiter_vorname || fields.bearbeiter_nachname) && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Bearbeiter</h3>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <IconUser size={14} className="shrink-0 text-muted-foreground" />
                <span>{[fields.bearbeiter_vorname, fields.bearbeiter_nachname].filter(Boolean).join(' ')}</span>
              </div>
            </section>
          )}

          {/* Umsetzungskommentar */}
          {fields.umsetzungskommentar && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Umsetzungskommentar</h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{fields.umsetzungskommentar}</p>
            </section>
          )}

          {/* Erledigungsdatum */}
          {fields.erledigungsdatum && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Erledigungsdatum</h3>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <IconCalendar size={14} className="shrink-0 text-muted-foreground" />
                <span>{formatDate(fields.erledigungsdatum)}</span>
              </div>
            </section>
          )}

          {/* Metadaten */}
          <section className="pt-2 border-t border-border">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Datensatz</h3>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>ID: <span className="font-mono">{record.record_id}</span></div>
              <div>Erstellt: {formatDate(record.createdat)}</div>
              {record.updatedat && <div>Geändert: {formatDate(record.updatedat)}</div>}
            </div>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
}

// --- File Preview Thumbnail ---

function FilePreview({ url, onOpen }: { url: string; onOpen: (url: string) => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const filename = url.split('/').pop()?.split('?')[0] ?? 'Datei';
  const likelyImage = !imgFailed && (isImageUrl(url) || !url.match(/\.(pdf|doc|docx|xls|xlsx|csv|zip|txt)(\?.*)?$/i));

  if (likelyImage) {
    return (
      <button
        onClick={() => onOpen(url)}
        className="block rounded-xl overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all w-28 h-24 bg-muted shrink-0"
        title="Bild in Vollansicht öffnen"
      >
        <img
          src={url}
          alt={filename}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </button>
    );
  }

  return (
    <button
      onClick={() => onOpen(url)}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted hover:border-primary hover:bg-accent transition-colors text-sm text-foreground max-w-xs"
      title="Datei öffnen"
    >
      <IconFileDescription size={18} className="shrink-0 text-muted-foreground" />
      <span className="truncate min-w-0">{filename}</span>
      <IconExternalLink size={13} className="shrink-0 text-muted-foreground ml-auto" />
    </button>
  );
}

// --- Lightbox ---

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const filename = url.split('/').pop()?.split('?')[0] ?? 'Datei';
  const showAsImage = !imgFailed;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <a
          href={url}
          download={filename}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Herunterladen"
        >
          <IconDownload size={18} className="shrink-0" />
        </a>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Schließen"
        >
          <IconX size={18} className="shrink-0" />
        </button>
      </div>

      {/* Content */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {showAsImage ? (
          <img
            src={url}
            alt={filename}
            className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card shadow-2xl">
            <IconFileDescription size={56} stroke={1.5} className="text-muted-foreground" />
            <p className="text-sm text-foreground font-medium text-center max-w-xs break-all">{filename}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
            >
              <IconExternalLink size={15} className="shrink-0" />
              Datei öffnen
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Kanban Card Component ---

interface KanbanCardProps {
  record: Aenderungsvorschlag;
  colColor: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (record: Aenderungsvorschlag, newStatus: string) => void;
  onDetail: () => void;
}

function KanbanCard({ record, onEdit, onDelete, onStatusChange, onDetail }: KanbanCardProps) {
  const { fields } = record;
  const prioritaetKey = fields.prioritaet?.key ?? '';
  const kategorieKey = fields.kategorie?.key ?? '';
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const nextStatuses = COLUMNS.filter(c => c.key !== (fields.status?.key ?? 'offen'));

  return (
    <div className="group relative bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Priorität badge */}
      {prioritaetKey && (
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITAET_COLORS[prioritaetKey] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {prioritaetKey === 'kritisch' && <IconAlertTriangle size={10} className="shrink-0" />}
            {fields.prioritaet?.label ?? prioritaetKey}
          </span>
          {/* Action buttons — always visible */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={onEdit}
              title="Bearbeiten"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <IconPencil size={13} className="shrink-0" />
            </button>
            <button
              onClick={onDelete}
              title="Löschen"
              className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <IconTrash size={13} className="shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* No priority — still show actions */}
      {!prioritaetKey && (
        <div className="flex justify-end mb-1">
          <div className="flex items-center gap-0.5">
            <button
              onClick={onEdit}
              title="Bearbeiten"
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <IconPencil size={13} className="shrink-0" />
            </button>
            <button
              onClick={onDelete}
              title="Löschen"
              className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <IconTrash size={13} className="shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Titel — klickbarer Link */}
      <button
        onClick={onDetail}
        className="w-full text-left text-sm font-semibold leading-snug mb-1 transition-colors text-orange-500 hover:text-orange-600 hover:underline underline-offset-2 flex items-start gap-1"
      >
        <span className="line-clamp-2 min-w-0 flex-1">{fields.titel ?? '(Kein Titel)'}</span>
        <IconExternalLink size={12} className="shrink-0 mt-0.5 opacity-70" />
      </button>

      {/* Bereich */}
      {fields.betroffener_bereich && (
        <p className="text-xs text-muted-foreground truncate mb-2">
          {fields.betroffener_bereich}
        </p>
      )}

      {/* Beschreibung snippet */}
      {fields.beschreibung && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
          {fields.beschreibung}
        </p>
      )}

      {/* Kategorie + Datum */}
      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-border">
        {kategorieKey && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            {KATEGORIE_ICONS[kategorieKey]}
            <span className="truncate max-w-[100px]">{fields.kategorie?.label}</span>
          </span>
        )}
        {fields.einreichungsdatum && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-auto">
            <IconCalendar size={11} className="shrink-0" />
            {formatDate(fields.einreichungsdatum)}
          </span>
        )}
      </div>

      {/* Einreicher */}
      {(fields.einreicher_vorname || fields.einreicher_nachname) && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
          <IconUser size={11} className="shrink-0" />
          <span className="truncate">
            {[fields.einreicher_vorname, fields.einreicher_nachname].filter(Boolean).join(' ')}
          </span>
        </div>
      )}

      {/* Status-Schnellwechsel */}
      <div className="mt-2 pt-2 border-t border-border relative">
        <button
          onClick={() => setShowStatusMenu(v => !v)}
          className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <span>Status ändern</span>
          <IconX size={10} className={`ml-auto transition-transform ${showStatusMenu ? 'rotate-0' : 'rotate-45'}`} />
        </button>
        {showStatusMenu && (
          <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
            {nextStatuses.map(s => (
              <button
                key={s.key}
                onClick={() => { setShowStatusMenu(false); onStatusChange(record, s.key); }}
                className={`w-full text-left px-3 py-2 text-xs font-medium ${s.color} hover:${s.bgColor} transition-colors`}
              >
                → {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Skeleton & Error ---

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 flex-1 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
