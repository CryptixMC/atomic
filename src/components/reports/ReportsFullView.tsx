import { useEffect, useRef } from 'react';
import { useReportsStore } from '../../stores/reports';
import { ReportsList } from './ReportsList';

/// Top-level reports view, mounted by MainView when viewMode === 'reports'.
/// Mirrors WikiFullView's shape: initialize the store once on mount,
/// tear down on unmount. The list itself owns rendering + virtualization.
///
/// 4a is read-only — no create button, no row click handler. Those land
/// in 4b/4c respectively.
export function ReportsFullView() {
  const reports = useReportsStore(s => s.reports);
  const lastFindingByReport = useReportsStore(s => s.lastFindingByReport);
  const isLoadingList = useReportsStore(s => s.isLoadingList);
  const fetchAll = useReportsStore(s => s.fetchAll);
  const reset = useReportsStore(s => s.reset);

  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchAll();
  }, [fetchAll]);

  // Clean up store state + the atom-created subscription on unmount.
  useEffect(() => {
    return () => { reset(); };
  }, [reset]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <ReportsList
        reports={reports}
        lastFindingByReport={lastFindingByReport}
        isLoading={isLoadingList}
      />
    </div>
  );
}
