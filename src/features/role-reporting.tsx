import { Link } from "react-router-dom";
import type { SWRResponse } from "swr";
import {
  ArrowRight,
  ClipboardList,
  History,
  ScanLine,
  TrendingUp,
} from "lucide-react";
import type {
  Category,
  CategoryStats,
  Envelope,
  Filters,
  Report,
  Summary,
} from "../lib/types";
import { formatTime } from "../lib/types";
import { Empty, ErrorNotice, SkeletonBars, SkeletonRows } from "../components/ui";
import { StatusBadge } from "./reports";
import { change, describePeriod } from "./period";

/**
 * OPERATIONAL REPORTING DASHBOARDS for Head Nurses and Pharmacists (shown instead of the graph-based analytics,
 * see dashboard-visibility.ts). Every figure is taken from data the application already loads: the summary and
 * category endpoints of the signed-in user (/api/me/dashboard/*) and that user's own report list. Nothing is
 * estimated, and no clinical interpretation is offered.
 */
const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

export interface ReportingData {
  filters: Filters;
  summary: SWRResponse<Envelope<Summary>>;
  categories: SWRResponse<Envelope<CategoryStats>>;
  recent: SWRResponse<Envelope<Report[]>>;
  /** Present only when both dates are selected, so a previous period of equal length is defined. */
  previous?: SWRResponse<Envelope<Summary>>;
  /** Categories this role may use (from /api/categories), so categories with no selections are still listed. */
  roleCategories: Category[];
}

/** Category rows for the signed-in role: every allowed category (zero included), most selected first. */
function categoryRows(data: ReportingData, role: "HEAD_NURSE" | "PHARMACIST") {
  const stats = data.categories.data?.data;
  const counted = new Map(
    (stats?.categories ?? [])
      .filter((c) => c.allowedRole === role)
      .map((c) => [c.categoryId, c.selectionCount] as const),
  );
  const names = new Map<number, string>();
  (stats?.categories ?? []).forEach((c) => names.set(c.categoryId, c.name));
  data.roleCategories
    .filter((c) => c.allowedRole === role)
    .forEach((c) => {
      if (!names.has(c.id)) names.set(c.id, c.name);
      if (!counted.has(c.id)) counted.set(c.id, 0);
    });
  const totalSelections = stats?.totals.totalCategorySelections ?? 0;
  return [...counted.entries()]
    .map(([id, count]) => ({
      id,
      name: names.get(id) ?? `Category ${id}`,
      count,
      share: totalSelections ? (count / totalSelections) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function ComplianceMeter({ s }: { s: Summary }) {
  const total = s.totalChecks;
  const compliant = total ? (s.compliantChecks / total) * 100 : 0;
  return (
    <div className="meter-block">
      <div
        className="stack-bar"
        role="img"
        aria-label={`${s.compliantChecks} compliant and ${s.nonCompliantChecks} non-compliant checks`}
      >
        <span className="ok" style={{ width: `${compliant}%` }} />
        <span className="warn" style={{ width: `${total ? 100 - compliant : 0}%` }} />
      </div>
      <div className="perf-legend">
        <span><i className="ok" />Compliant {s.compliantChecks.toLocaleString()}</span>
        <span><i className="warn" />Non-compliant {s.nonCompliantChecks.toLocaleString()}</span>
      </div>
    </div>
  );
}

function CategoryBars({
  rows,
  loading,
  error,
  retry,
}: {
  rows: ReturnType<typeof categoryRows>;
  loading: boolean;
  error: unknown;
  retry: () => void;
}) {
  if (loading) return <SkeletonBars label="Loading categories…" />;
  if (error) return <ErrorNotice error={error} retry={retry} />;
  if (!rows.length) return <Empty title="No categories available" />;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="rank-list">
      {rows.map((row) => (
        <li key={row.id}>
          <div>
            <span>{row.name}</span>
            <strong>
              {row.count.toLocaleString()}
              <small>{row.count ? ` · ${row.share.toFixed(0)}%` : ""}</small>
            </strong>
          </div>
          <div className="bar-track" aria-hidden="true">
            <div style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecentActivity({
  data,
  timeline = false,
}: {
  data: ReportingData;
  timeline?: boolean;
}) {
  const { recent } = data;
  const items = recent.data?.data ?? [];
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{timeline ? "Recent pharmacy reporting activity" : "Recent reporting activity"}</h2>
          <p>Your latest submissions within the selected period</p>
        </div>
        <Link to="/reports" className="text-button">
          Full history <ArrowRight size={15} />
        </Link>
      </div>
      {recent.isLoading ? (
        <SkeletonRows rows={4} label="Loading recent reporting activity…" />
      ) : recent.error ? (
        <ErrorNotice error={recent.error} retry={() => void recent.mutate()} />
      ) : !items.length ? (
        <Empty
          title="No reporting activity in this period"
          icon={<History size={30} />}
        >
          Submitted checks and reports will appear here.
        </Empty>
      ) : timeline ? (
        <ol className="timeline">
          {items.map((r) => (
            <li key={r.id}>
              <Link to={`/reports?record=${r.id}`}>
                <span className="timeline-time">{formatTime(r.submittedAt)}</span>
                <span className="timeline-body">
                  <strong className="mono">MR {r.mrNumber}</strong>
                  <StatusBadge status={r.checkStatus} />
                  {r.categories.length > 0 && (
                    <span className="tags">
                      {r.categories.map((c) => (
                        <span className="pill" key={c}>{c}</span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Submitted (PKT)</th>
                <th>MR Number</th>
                <th>Status</th>
                <th>Categories</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td data-label="Submitted (PKT)">{formatTime(r.submittedAt)}</td>
                  <td data-label="MR Number">
                    <Link className="mono row-link" to={`/reports?record=${r.id}`}>{r.mrNumber}</Link>
                  </td>
                  <td data-label="Status"><StatusBadge status={r.checkStatus} /></td>
                  <td data-label="Categories">
                    {r.categories.length ? r.categories.join(" · ") : <span className="muted">None (compliant check)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Head Nurse: clinical monitoring and reporting overview. */
export function HeadNurseReporting(data: ReportingData) {
  const { summary, categories, filters } = data;
  const s = summary.data?.data;
  const rows = categoryRows(data, "HEAD_NURSE");
  const top = rows.filter((r) => r.count > 0).slice(0, 5);
  const used = rows.filter((r) => r.count > 0).length;
  return (
    <>
      <h2 className="group-heading">Clinical reporting overview</h2>
      <div className="report-overview">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Clinical compliance overview</h2>
              <p>Completed patient checks under the selected filters</p>
            </div>
          </div>
          {summary.isLoading ? (
            <SkeletonBars rows={3} label="Loading compliance overview…" />
          ) : summary.error ? (
            <ErrorNotice error={summary.error} retry={() => void summary.mutate()} />
          ) : s && s.totalChecks ? (
            <div className="overview-body">
              <div className="rate-pair">
                <div>
                  <strong>{percent(s.complianceRate)}</strong>
                  <span>Compliance rate</span>
                </div>
                <div>
                  <strong>{percent(s.nonComplianceRate)}</strong>
                  <span>Non-compliance rate</span>
                </div>
              </div>
              <ComplianceMeter s={s} />
              <dl className="kv-grid">
                <div><dt>Total patient checks</dt><dd>{s.totalChecks.toLocaleString()}</dd></div>
                <div><dt>Compliant checks</dt><dd>{s.compliantChecks.toLocaleString()}</dd></div>
                <div><dt>Non-compliant checks</dt><dd>{s.nonCompliantChecks.toLocaleString()}</dd></div>
              </dl>
            </div>
          ) : (
            <Empty title="No checks in this period" />
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Reporting period summary</h2>
              <p>What the current filters cover</p>
            </div>
          </div>
          {summary.isLoading ? (
            <SkeletonBars rows={4} label="Loading period summary…" />
          ) : summary.error ? (
            <ErrorNotice error={summary.error} retry={() => void summary.mutate()} />
          ) : s ? (
            <dl className="summary-list">
              <div><dt>Selected period</dt><dd>{describePeriod(filters)}</dd></div>
              <div><dt>Non-compliance reports</dt><dd>{s.totalReports.toLocaleString()}</dd></div>
              <div>
                <dt>Compliant vs non-compliant checks</dt>
                <dd>{s.compliantChecks.toLocaleString()} vs {s.nonCompliantChecks.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Categories reported</dt>
                <dd>{categories.data ? `${used} of ${rows.length} available` : "—"}</dd>
              </div>
            </dl>
          ) : null}
        </section>
      </div>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Non-compliance monitoring insights</h2>
            <p>
              {top.length
                ? `Most frequently reported: ${top[0].name} (${top[0].count.toLocaleString()} ${top[0].count === 1 ? "selection" : "selections"})`
                : "Distribution of the categories you have reported in this period"}
            </p>
          </div>
          <Link className="text-button" to="/reports">
            Review reports <ArrowRight size={15} />
          </Link>
        </div>
        <CategoryBars
          rows={rows}
          loading={categories.isLoading}
          error={categories.error}
          retry={() => void categories.mutate()}
        />
        <p className="panel-note">
          A report can include more than one category, so selections may exceed the number of reports.
        </p>
      </section>

      <RecentActivity data={data} />
    </>
  );
}

/** Pharmacist: pharmacy-focused reporting overview (deliberately a different layout from the Head Nurse view). */
export function PharmacistReporting(data: ReportingData) {
  const { summary, categories, previous, filters } = data;
  const s = summary.data?.data;
  const p = previous?.data?.data;
  const rows = categoryRows(data, "PHARMACIST");
  const ranked = rows.filter((r) => r.count > 0);
  const top = ranked[0];
  const tiles = s
    ? [
        { label: "Total checks", value: s.totalChecks.toLocaleString() },
        { label: "Compliant checks", value: s.compliantChecks.toLocaleString() },
        { label: "Non-compliant checks", value: s.nonCompliantChecks.toLocaleString() },
        { label: "Compliance rate", value: percent(s.complianceRate) },
        { label: "Submitted reports", value: s.totalReports.toLocaleString() },
      ]
    : [];
  const comparison = s && p
    ? [
        { label: "Checks", now: s.totalChecks, before: p.totalChecks },
        { label: "Non-compliance reports", now: s.totalReports, before: p.totalReports },
      ]
    : [];
  return (
    <>
      <h2 className="group-heading">Clinical pharmacy reporting</h2>
      <section className="panel pharm-ledger" aria-label="Pharmacy reporting overview">
        <div className="panel-heading">
          <div>
            <h2>Pharmacy reporting overview</h2>
            <p>{describePeriod(filters)}</p>
          </div>
        </div>
        {summary.isLoading ? (
          <SkeletonBars rows={2} label="Loading pharmacy overview…" />
        ) : summary.error ? (
          <ErrorNotice error={summary.error} retry={() => void summary.mutate()} />
        ) : (
          <div className="ledger">
            {tiles.map((t) => (
              <div key={t.label}><strong>{t.value}</strong><span>{t.label}</span></div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Non-compliance category overview</h2>
            <p>Selections per category you can report against</p>
          </div>
        </div>
        {categories.isLoading ? (
          <SkeletonBars label="Loading categories…" />
        ) : categories.error ? (
          <ErrorNotice error={categories.error} retry={() => void categories.mutate()} />
        ) : !rows.length ? (
          <Empty title="No categories available" />
        ) : (
          <div className="category-tiles">
            {rows.map((row) => (
              <div className={`category-tile ${row.count ? "" : "is-zero"}`} key={row.id}>
                <span>{row.name}</span>
                <strong>{row.count.toLocaleString()}</strong>
                <div className="bar-track" aria-hidden="true">
                  <div style={{ width: `${row.share}%` }} />
                </div>
                <small>{row.count ? `${row.share.toFixed(0)}% of selections` : "No selections"}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="report-overview">
        <RecentActivity data={data} timeline />
        <div className="stacked-panels">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2><TrendingUp size={17} /> Reporting insights</h2>
                <p>From your own reports in the selected period</p>
              </div>
            </div>
            {categories.isLoading || summary.isLoading ? (
              <SkeletonBars rows={3} label="Loading insights…" />
            ) : (
              <dl className="summary-list">
                <div>
                  <dt>Most frequently reported</dt>
                  <dd>{top ? `${top.name} (${top.count.toLocaleString()})` : "No category selections yet"}</dd>
                </div>
                {ranked.slice(1, 3).map((r, i) => (
                  <div key={r.id}>
                    <dt>{i === 0 ? "Second most reported" : "Third most reported"}</dt>
                    <dd>{r.name} ({r.count.toLocaleString()})</dd>
                  </div>
                ))}
                {previous ? (
                  previous.isLoading ? (
                    <div><dt>Compared with previous period</dt><dd>Loading…</dd></div>
                  ) : previous.error ? (
                    <div><dt>Compared with previous period</dt><dd>Unavailable</dd></div>
                  ) : (
                    comparison.map((row) => {
                      const d = change(row.now, row.before);
                      return (
                        <div key={row.label}>
                          <dt>{row.label}: previous period</dt>
                          <dd>
                            {row.before.toLocaleString()} → {row.now.toLocaleString()} ({d.label}
                            {d.percent !== undefined && d.diff !== 0 ? `, ${d.percent > 0 ? "+" : "−"}${Math.abs(d.percent).toFixed(0)}%` : ""})
                          </dd>
                        </div>
                      );
                    })
                  )
                ) : (
                  <div><dt>Compared with previous period</dt><dd>Select a From and To date to compare</dd></div>
                )}
              </dl>
            )}
          </section>
          <section className="panel quick-access">
            <div className="panel-heading">
              <div>
                <h2>Quick reporting access</h2>
                <p>Jump straight to the reporting actions you use most</p>
              </div>
            </div>
            <div className="quick-grid">
              <Link to="/new-report">
                <span><ScanLine size={20} /></span>
                <div><strong>New patient check</strong><small>Scan a QR code and record the outcome</small></div>
                <ArrowRight size={16} />
              </Link>
              <Link to="/reports">
                <span><ClipboardList size={20} /></span>
                <div><strong>My reports</strong><small>Review and filter your submissions</small></div>
                <ArrowRight size={16} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
