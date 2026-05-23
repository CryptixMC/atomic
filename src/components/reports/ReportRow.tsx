import { memo, useMemo } from 'react';
import { Report, ReportFindingWithAtom } from '../../stores/reports';
import { StatusBadge } from './StatusBadge';
import { ScheduleStrip } from './ScheduleStrip';

interface ReportRowProps {
  report: Report;
  /// Pre-fetched last finding. `null` = no findings yet. `undefined` =
  /// hydration in flight; we render a placeholder excerpt skeleton.
  lastFinding: ReportFindingWithAtom | null | undefined;
  isRunning?: boolean;
  /// Whether this report's id matches the dashboard's featured-report
  /// pointer. Renders a small "FEATURED" eyebrow chip in the identity
  /// column when true. Wired up in 4c; 4a always passes false.
  isFeatured?: boolean;
  onClick?: (reportId: string) => void;
}

/// One row in the reports list. Three-column geometry:
///   identity (name, last-finding excerpt) | schedule | status
///
/// Slim and wide rather than card-shaped so we stay visually distinct
/// from the wiki grid. Hover lifts the background by one tone; running
/// reports get a faint purple border. Clicking the row will open the
/// detail view (wired in 4c) — for 4a the click handler is optional and
/// no-ops when omitted.
function shortenExcerpt(content: string, limit = 110): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  return flat.slice(0, limit - 1).trimEnd() + '…';
}

export const ReportRow = memo(function ReportRow({
  report,
  lastFinding,
  isRunning = false,
  isFeatured = false,
  onClick,
}: ReportRowProps) {
  const excerpt = useMemo(() => {
    if (lastFinding === undefined) return null;        // loading
    if (lastFinding === null) return 'No findings yet'; // empty
    return shortenExcerpt(lastFinding.atom.content);
  }, [lastFinding]);

  const interactive = Boolean(onClick);

  return (
    <div
      className={`
        group relative grid grid-cols-[1fr_auto_auto] items-center gap-6 px-5 py-4
        border-b border-[var(--color-border)]
        ${interactive ? 'cursor-pointer hover:bg-[var(--color-bg-hover)]' : ''}
        ${isRunning ? 'ring-1 ring-inset ring-[var(--color-accent)]/40 animate-[pulse_2.4s_ease-in-out_infinite]' : ''}
        transition-colors
      `}
      onClick={() => onClick?.(report.id)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(report.id);
        }
      } : undefined}
    >
      {/* Identity column */}
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {isFeatured && (
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-light)]">
              Featured
            </span>
          )}
          <h3 className="text-[15px] font-medium text-[var(--color-text-primary)] truncate">
            {report.name}
          </h3>
        </div>
        <p className={`
          text-[13px] truncate
          ${lastFinding ? 'italic text-[var(--color-text-tertiary)]' : 'text-[var(--color-text-tertiary)]/70'}
        `}>
          {excerpt ?? (
            <span className="inline-block w-48 h-3 align-middle rounded bg-[var(--color-border)]/50 animate-pulse" />
          )}
        </p>
      </div>

      {/* Schedule column — strip + cron, mono. Hidden on mobile to keep
          the row from cramping; the status column already conveys
          enabled/paused/running which is what matters at a glance. */}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        <ScheduleStrip cron={report.schedule} tz={report.schedule_tz} muted={!report.enabled} />
        <div className="flex flex-col text-right">
          <code className="font-mono text-[11px] leading-tight text-[var(--color-text-secondary)] tabular-nums">
            {report.schedule}
          </code>
          {report.schedule_tz && (
            <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] leading-tight">
              {report.schedule_tz}
            </span>
          )}
        </div>
      </div>

      {/* Status column */}
      <div className="shrink-0">
        <StatusBadge report={report} isRunning={isRunning} />
      </div>
    </div>
  );
});
