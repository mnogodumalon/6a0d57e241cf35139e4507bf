import { useDashboardData } from '@/hooks/useDashboardData';
import type { Aenderungsvorschlag } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0d57e241cf35139e4507bf';
const REPAIR_ENDPOINT = '/claude/build/repair';

// Kanban column definitions (order matters)
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

export default function DashboardOverview() {
  const { aenderungsvorschlag, loading, error, fetchAll } = useDashboardData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Aenderungsvorschlag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Aenderungsvorschlag | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats — ALL hooks before any early returns
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

  // Filtered cards per column
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
}

function KanbanCard({ record, onEdit, onDelete, onStatusChange }: KanbanCardProps) {
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

      {/* Titel */}
      <p className="text-sm font-semibold text-foreground leading-snug mb-1 line-clamp-2">
        {fields.titel ?? '(Kein Titel)'}
      </p>

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
