import { create } from 'zustand';
import { toast } from 'sonner';
import { getTransport } from '../lib/transport';

// =====================================================================
// Types — mirror crates/atomic-core/src/models.rs
// =====================================================================

/// Discriminator on every atom; reports return findings with kind=report.
export type AtomKind = 'captured' | 'report';

export type SourceScopeWindow =
  | { kind: 'since_last_run' }
  | { kind: 'iso_duration'; value: string };

export type ContextScopeMode = 'all' | 'same_as_source' | 'tags' | 'none';

export type ContextScopeWindow = SourceScopeWindow;

export type CitationPolicy = 'source_only' | 'context_citable';

/// One report definition. Matches `Report` in atomic-core. Cache fields
/// (`last_run_at`, `last_finding_atom_id`, `last_error`) are advisory —
/// authoritative state lives on `task_runs` + `report_findings`.
export interface Report {
  id: string;
  name: string;
  description: string | null;
  research_prompt: string;

  source_scope_tag_ids: string[];
  source_scope_window: SourceScopeWindow | null;
  source_include_kinds: AtomKind[];

  context_scope_mode: ContextScopeMode;
  context_scope_tag_ids: string[];
  context_scope_window: ContextScopeWindow | null;
  context_include_kinds: AtomKind[];

  citation_policy: CitationPolicy;

  max_source_atoms: number | null;
  max_source_tokens: number | null;
  max_tool_iterations: number | null;

  schedule: string;
  schedule_tz: string | null;

  enabled: boolean;
  output_atom_tags: string[];

  last_run_at: string | null;
  last_finding_atom_id: string | null;
  last_error: string | null;

  created_at: string;
  updated_at: string;
}

export interface ReportFinding {
  finding_atom_id: string;
  report_id: string | null;
  run_id: string | null;
  report_name_snapshot: string;
  created_at: string;
}

export interface ReportFindingCitation {
  finding_atom_id: string;
  cited_atom_id: string;
  position: number;
  excerpt: string;
}

/// What `list_findings_for_report` returns: each finding row joined with
/// the standard AtomWithTags snippet. `serde(flatten)` on AtomWithTags
/// means atom fields live at the top of `atom` (no nested `.atom`).
export interface ReportFindingWithAtom {
  finding: ReportFinding;
  atom: {
    id: string;
    content: string;
    source_url: string | null;
    created_at: string;
    updated_at: string;
    kind: AtomKind;
    [k: string]: unknown;
  };
}

// =====================================================================
// Store
// =====================================================================

interface ReportsStore {
  reports: Report[];
  byId: Record<string, Report>;

  /// Cached last finding per report so the list view's tertiary line
  /// (the italic excerpt) doesn't issue N requests on every render.
  /// `null` after a fetch attempt means "no findings yet" — distinguishes
  /// from `undefined` ("never fetched").
  lastFindingByReport: Record<string, ReportFindingWithAtom | null>;

  isLoadingList: boolean;
  loadError: string | null;

  /// Has the atom-created subscription already been set up? Guards
  /// against double-subscription if `fetchAll` is called twice.
  hasSubscription: boolean;

  fetchAll: () => Promise<void>;
  fetchLastFinding: (reportId: string) => Promise<void>;
  reset: () => void;
}

export const useReportsStore = create<ReportsStore>((set, get) => {
  // Module-scope handle for the atom-created unsubscribe so `reset()` can
  // tear it down. Captured in closure rather than store state because it
  // isn't render-relevant.
  let atomCreatedUnsub: (() => void) | null = null;

  return {
    reports: [],
    byId: {},
    lastFindingByReport: {},
    isLoadingList: false,
    loadError: null,
    hasSubscription: false,

    fetchAll: async () => {
      set({ isLoadingList: true, loadError: null });
      try {
        const reports = await getTransport().invoke<Report[]>('list_reports');
        const byId: Record<string, Report> = {};
        for (const r of reports) byId[r.id] = r;
        set({ reports, byId, isLoadingList: false });

        // Lazily prime last-finding for every report. Issue requests in
        // parallel; failures degrade to "no excerpt available" without
        // surfacing per-report toasts.
        await Promise.all(reports.map(r => get().fetchLastFinding(r.id)));

        // Wire the live-refresh subscription once. The dashboard
        // BriefingWidget uses the same shape: AtomWithTags flattens, so
        // `kind` lives at the payload top level. When a report finding
        // lands we refresh just that report's last-finding cache (and
        // could re-fetch the row itself if we needed updated `last_run_at`;
        // for 4a the cache update on next list refresh is sufficient).
        if (!get().hasSubscription) {
          atomCreatedUnsub = getTransport().subscribe('atom-created', (payload) => {
            const p = payload as { kind?: string; id?: string } | undefined;
            if (p?.kind !== 'report') return;
            // We don't know which report produced it from the payload
            // alone, so re-prime last-finding for every report we know
            // about. Cheap (one request each, no joins beyond atom tags).
            const ids = Object.keys(get().byId);
            ids.forEach(id => get().fetchLastFinding(id));
          });
          set({ hasSubscription: true });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        set({ isLoadingList: false, loadError: msg });
        toast.error('Failed to load reports', { description: msg });
      }
    },

    fetchLastFinding: async (reportId: string) => {
      try {
        const results = await getTransport().invoke<ReportFindingWithAtom[]>(
          'list_findings_for_report',
          { report_id: reportId, limit: 1 }
        );
        const first = results[0] ?? null;
        set(state => ({
          lastFindingByReport: { ...state.lastFindingByReport, [reportId]: first },
        }));
      } catch (e) {
        // Per-report failure: leave the cache untouched, log, and let the
        // row render without an excerpt. We don't toast — N possible
        // failures would flood the user.
        console.error('[reports] fetchLastFinding failed', reportId, e);
      }
    },

    reset: () => {
      atomCreatedUnsub?.();
      atomCreatedUnsub = null;
      set({
        reports: [],
        byId: {},
        lastFindingByReport: {},
        isLoadingList: false,
        loadError: null,
        hasSubscription: false,
      });
    },
  };
});
