import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useReportsStore } from '../../stores/reports';
import { useUIStore } from '../../stores/ui';
import { StatusBadge } from './StatusBadge';

interface ReportDetailViewProps {
  reportId: string;
}

/// Top-level detail view for a single report. Step-1 skeleton: header
/// with back button + name + status badge, placeholder body. Findings
/// list, run-now, and the featured-star toggle land in later steps of
/// 4c.
///
/// Data flow:
/// - Reads the active report from `useReportsStore.byId[reportId]`.
/// - If the row isn't loaded (cold-start deep link, or list not yet
///   fetched), fetches it via `fetchOne`. On 404 → toast + close.
/// - Closing the view defers to `closeReportDetail`, which delegates
///   to `closeTab(activeTabId)` — same fallback-to-base-view path as
///   AtomReader.
export function ReportDetailView({ reportId }: ReportDetailViewProps) {
  const report = useReportsStore(s => s.byId[reportId]);
  const fetchOne = useReportsStore(s => s.fetchOne);
  const closeReportDetail = useUIStore(s => s.closeReportDetail);

  const [isInitialFetch, setIsInitialFetch] = useState(!report);

  useEffect(() => {
    if (report) {
      setIsInitialFetch(false);
      return;
    }
    let cancelled = false;
    setIsInitialFetch(true);
    fetchOne(reportId).then((r) => {
      if (cancelled) return;
      setIsInitialFetch(false);
      if (!r) {
        toast.error('Report not found', {
          description: 'It may have been deleted in another window.',
        });
        closeReportDetail();
      }
    });
    return () => { cancelled = true; };
    // Intentionally not depending on `report` — once we have it the
    // first branch returns; we don't want to refetch on byId churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, fetchOne, closeReportDetail]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Header: back + name + status */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--color-border)] flex-shrink-0">
        <button
          onClick={closeReportDetail}
          title="Back to reports"
          aria-label="Back to reports"
          className="
            p-1.5 rounded-md text-[var(--color-text-secondary)]
            hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]
            transition-colors
          "
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          {report ? (
            <>
              <h2 className="text-base font-medium text-[var(--color-text-primary)] truncate">
                {report.name}
              </h2>
              <StatusBadge report={report} />
            </>
          ) : isInitialFetch ? (
            <div className="h-4 w-48 bg-[var(--color-border)] rounded animate-pulse" />
          ) : (
            <h2 className="text-base font-medium text-[var(--color-text-tertiary)]">
              Report unavailable
            </h2>
          )}
        </div>
      </div>

      {/* Body — placeholder until steps 2-5 land the meta band,
          findings list, and action affordances. */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {report ? (
          <div className="max-w-3xl mx-auto text-sm text-[var(--color-text-tertiary)] leading-relaxed">
            <p>Findings history, run-now, schedule details, and the dashboard
            featured toggle land in upcoming sub-steps of 4c.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
