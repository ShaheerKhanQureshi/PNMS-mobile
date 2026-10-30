import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import useSWR, { type SWRResponse } from "swr";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowUpRight, Users } from "lucide-react";
import { api } from "../lib/api";
import type {
  Envelope,
  Summary,
  Trends,
  CategoryStats,
  Filters,
  Role,
  User,
} from "../lib/types";
import { ErrorNotice, Empty, SkeletonBars, SkeletonPanel } from "../components/ui";
import { chartPalette, useTheme } from "../lib/theme";
import { change, describePeriod } from "./period";

/**
 * GRAPH-BASED ANALYTICS.
 *
 * Everything in this file is the graphical analytics layer. Which roles see it is decided in one place,
 * dashboard-visibility.ts. The components below keep the original chart configuration and data inputs; the
 * Super Admin additions (CompliancePerformance, AdminInsights) only read data the dashboard already fetches or
 * endpoints the application already uses.
 */
const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

const NARROW = "(max-width: 600px)";
function useNarrow() {
  return useSyncExternalStore(
    (callback) => {
      const query = window.matchMedia?.(NARROW);
      query?.addEventListener?.("change", callback);
      return () => query?.removeEventListener?.("change", callback);
    },
    () => window.matchMedia?.(NARROW).matches ?? false,
    () => false,
  );
}

function useChartStyle() {
  const { resolved } = useTheme();
  const palette = chartPalette(resolved);
  const tooltip = {
    contentStyle: {
      background: palette.tooltipBg,
      border: `1px solid ${palette.tooltipBorder}`,
      borderRadius: 8,
      color: palette.tooltipText,
      fontSize: 12,
    },
    labelStyle: { color: palette.tooltipText, fontWeight: 600 },
    itemStyle: { color: palette.tooltipText },
    cursor: { fill: palette.grid, fillOpacity: 0.45 },
  };
  return { palette, tooltip };
}

export interface AnalyticsData {
  admin: boolean;
  summary: SWRResponse<Envelope<Summary>>;
  trends: SWRResponse<Envelope<Trends>>;
  categories: SWRResponse<Envelope<CategoryStats>>;
  interval: string;
  setInterval: (interval: string) => void;
  selectedRole?: Role;
}

/** The original charts: Submission trends, Check outcomes, Reporting by role and the category sections. */
export function GraphicalAnalytics({
  admin,
  summary,
  trends,
  categories,
  interval,
  setInterval,
  selectedRole,
}: AnalyticsData) {
  const { palette, tooltip } = useChartStyle();
  const s = summary.data?.data;
  const t = trends.data?.data;
  const c = categories.data?.data;
  const roleData = s
    ? [
        { name: "Head Nurse", role: "HEAD_NURSE", value: s.headNurseReports },
        { name: "Pharmacist", role: "PHARMACIST", value: s.pharmacistReports },
      ].filter((r) => !selectedRole || r.role === selectedRole)
    : [];
  const outcomeData = s
    ? [
        { name: "Compliant", value: s.compliantChecks, color: palette.ok },
        { name: "Non-compliant", value: s.nonCompliantChecks, color: palette.warn },
      ]
    : [];
  const sections: { role: Role; title: string }[] = (
    [
      {
        role: "HEAD_NURSE" as Role,
        title: "Head Nurse — Non-Compliance Categories",
      },
      {
        role: "PHARMACIST" as Role,
        title: "Pharmacist — Non-Compliance Categories",
      },
    ] as { role: Role; title: string }[]
  ).filter((section) => !selectedRole || section.role === selectedRole);
  return (
    <>
      <div className="dashboard-charts">
        <section className="panel trend-panel">
          <div className="panel-heading">
            <div>
              <h2>Submission trends</h2>
              <p>Compliant checks and non-compliance reports over time</p>
            </div>
            <div className="segmented" aria-label="Trend interval">
              {["daily", "weekly", "monthly"].map((i) => (
                <button
                  key={i}
                  aria-pressed={interval === i}
                  className={interval === i ? "selected" : ""}
                  onClick={() => setInterval(i)}
                >
                  {i[0].toUpperCase() + i.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {trends.isLoading ? (
            <SkeletonPanel height={250} label="Loading trends…" />
          ) : trends.error ? (
            <ErrorNotice
              error={trends.error}
              retry={() => void trends.mutate()}
            />
          ) : t?.points.length ? (
            <>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={t.points}
                    margin={{ top: 15, right: 20, bottom: 5, left: 0 }}
                    accessibilityLayer
                  >
                    <CartesianGrid vertical={false} stroke={palette.grid} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11, fill: palette.axis }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: palette.axis }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip {...tooltip} />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      wrapperStyle={{ color: palette.axis, fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="compliantCount"
                      name="Compliant checks"
                      stroke={palette.ok}
                      fill={palette.okFill}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="reportCount"
                      name="Non-compliance reports"
                      stroke={palette.warn}
                      fill={palette.warnFill}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-caption">
                {t.from} to {t.to} · Pakistan Standard Time (UTC
                {t.timezoneOffset})
              </p>
              <details className="chart-data">
                <summary>View trend data</summary>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Period</th>
                        <th>Total checks</th>
                        <th>Compliant</th>
                        <th>Non-compliance reports</th>
                        <th>Category selections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.points.map((p) => (
                        <tr key={p.bucket}>
                          <td>{p.bucket}</td>
                          <td>{p.checkCount}</td>
                          <td>{p.compliantCount}</td>
                          <td>{p.reportCount}</td>
                          <td>{p.categorySelectionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <Empty title="No trend data" />
          )}
        </section>
        <div className="chart-side">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Check outcomes</h2>
                <p>Compliant vs non-compliant check events</p>
              </div>
            </div>
            {summary.isLoading ? (
              <SkeletonPanel height={200} label="Loading check outcomes…" />
            ) : s?.totalChecks ? (
              <>
                <div className="role-chart">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart accessibilityLayer>
                      <Pie
                        data={outcomeData}
                        dataKey="value"
                        innerRadius={62}
                        outerRadius={83}
                        paddingAngle={3}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {outcomeData.map((r) => (
                          <Cell key={r.name} fill={r.color} />
                        ))}
                      </Pie>
                      <Tooltip {...tooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="donut-label">
                    <strong>{percent(s.complianceRate)}</strong>
                    <span>compliant</span>
                  </div>
                </div>
                <div className="legend">
                  {outcomeData.map((r) => (
                    <div key={r.name}>
                      <span>
                        <i style={{ background: r.color }} />
                        {r.name}
                      </span>
                      <strong>{r.value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : summary.error ? (
              <ErrorNotice error={summary.error} />
            ) : (
              <Empty title="No checks in this period" />
            )}
          </section>
          {admin && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Reporting by role</h2>
                  <p>Share of non-compliance reports</p>
                </div>
              </div>
              {summary.isLoading ? (
                <SkeletonBars rows={2} label="Loading reporting by role…" />
              ) : s?.totalReports ? (
                <div className="legend">
                  {roleData.map((r, i) => (
                    <div key={r.name}>
                      <span>
                        <i style={{ background: i ? palette.neutral : palette.ok }} />
                        {r.name}
                      </span>
                      <strong>{r.value.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
              ) : summary.error ? (
                <ErrorNotice error={summary.error} />
              ) : (
                <Empty title="No reports in this period" />
              )}
            </section>
          )}
        </div>
      </div>
      {sections.map((section) => {
        const items = (c?.categories ?? []).filter(
          (category) => category.allowedRole === section.role,
        );
        return (
          <section className="panel" key={section.role}>
            <div className="panel-heading">
              <div>
                <h2>
                  {admin ? section.title : "Your non-compliance categories"}
                </h2>
                <p>
                  A report can include more than one category. Selections may
                  exceed total reports.
                </p>
              </div>
              {admin && section.role === sections[0].role && (
                <Link className="text-button" to="/reports">
                  Explore reports <ArrowUpRight size={16} />
                </Link>
              )}
            </div>
            {categories.isLoading ? (
              <SkeletonBars label="Loading categories…" />
            ) : categories.error ? (
              <ErrorNotice
                error={categories.error}
                retry={() => void categories.mutate()}
              />
            ) : !items.length ? (
              <Empty title="No categories" />
            ) : (
              <div className="category-stats">
                {items.map((category) => (
                  <div className="category-stat" key={category.categoryId}>
                    <div>
                      <span>{category.name}</span>
                      <strong>{category.selectionCount.toLocaleString()}</strong>
                    </div>
                    <div className="bar-track">
                      <div
                        style={{
                          width: `${c && c.totals.totalReports ? Math.min(100, (category.selectionCount / c.totals.totalReports) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}

/** Super Admin: prominent overall compliance picture (all figures come from the summary the dashboard already loads). */
export function CompliancePerformance({
  summary,
}: {
  summary: SWRResponse<Envelope<Summary>>;
}) {
  const s = summary.data?.data;
  const total = s?.totalChecks ?? 0;
  const compliantShare = total && s ? (s.compliantChecks / total) * 100 : 0;
  return (
    <section className="panel perf-panel" aria-labelledby="perf-title">
      <div className="panel-heading">
        <div>
          <h2 id="perf-title">Compliance performance</h2>
          <p>Overall result of completed checks under the selected filters</p>
        </div>
      </div>
      {summary.isLoading ? (
        <SkeletonPanel height={110} label="Loading compliance performance…" />
      ) : summary.error ? (
        <ErrorNotice error={summary.error} retry={() => void summary.mutate()} />
      ) : s && total ? (
        <div className="perf-body">
          <div className="perf-rate">
            <strong>{percent(s.complianceRate)}</strong>
            <span>overall compliance</span>
          </div>
          <div className="perf-meter">
            <div
              className="stack-bar"
              role="img"
              aria-label={`${s.compliantChecks} compliant and ${s.nonCompliantChecks} non-compliant checks`}
            >
              <span className="ok" style={{ width: `${compliantShare}%` }} />
              <span className="warn" style={{ width: `${100 - compliantShare}%` }} />
            </div>
            <div className="perf-legend">
              <span><i className="ok" />Compliant {s.compliantChecks.toLocaleString()}</span>
              <span><i className="warn" />Non-compliant {s.nonCompliantChecks.toLocaleString()} ({percent(s.nonComplianceRate)})</span>
            </div>
          </div>
          <dl className="perf-totals">
            <div><dt>Total checks</dt><dd>{s.totalChecks.toLocaleString()}</dd></div>
            <div><dt>Submitted reports</dt><dd>{s.totalReports.toLocaleString()}</dd></div>
          </dl>
        </div>
      ) : (
        <Empty title="No checks in this period" />
      )}
    </section>
  );
}

/** Super Admin additions: category distribution, reporting activity timeline, period comparison, administrative overview. */
export function AdminInsights({
  summary,
  trends,
  categories,
  previous,
  period,
  filters,
  selectedRole,
}: {
  summary: SWRResponse<Envelope<Summary>>;
  trends: SWRResponse<Envelope<Trends>>;
  categories: SWRResponse<Envelope<CategoryStats>>;
  previous?: SWRResponse<Envelope<Summary>>;
  period?: { from: string; to: string; days: number };
  filters: Filters;
  selectedRole?: Role;
}) {
  const { palette, tooltip } = useChartStyle();
  const narrow = useNarrow();
  const s = summary.data?.data;
  const t = trends.data?.data;
  const c = categories.data?.data;
  const p = previous?.data?.data;
  // Same request keys as the report filters use, so these are served from the SWR cache (no extra requests).
  const nurses = useSWR<Envelope<User[]>>(
    "/api/users?role=HEAD_NURSE&limit=100&sortBy=fullName&sortOrder=asc",
    api,
  );
  const pharmacists = useSWR<Envelope<User[]>>(
    "/api/users?role=PHARMACIST&limit=100&sortBy=fullName&sortOrder=asc",
    api,
  );
  const distribution = (c?.categories ?? [])
    .filter((x) => !selectedRole || x.allowedRole === selectedRole)
    .filter((x) => x.selectionCount > 0)
    .sort((a, b) => b.selectionCount - a.selectionCount)
    .slice(0, 8)
    .map((x) => ({
      name:
        x.name.length > (narrow ? 16 : 28)
          ? `${x.name.slice(0, narrow ? 15 : 27)}…`
          : x.name,
      full: x.name,
      value: x.selectionCount,
    }));
  const staffRows = [
    { label: "Head Nurses", res: nurses },
    { label: "Pharmacists", res: pharmacists },
  ];
  const comparisonRows = s && p
    ? [
        { label: "Total check events", now: s.totalChecks, before: p.totalChecks },
        { label: "Compliant checks", now: s.compliantChecks, before: p.compliantChecks },
        { label: "Non-compliant checks", now: s.nonCompliantChecks, before: p.nonCompliantChecks },
        { label: "Non-compliance reports", now: s.totalReports, before: p.totalReports },
      ]
    : [];
  return (
    <>
      <h2 className="group-heading">Category distribution &amp; activity</h2>
      <div className="insight-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Category distribution</h2>
              <p>Most selected non-compliance categories (top 8)</p>
            </div>
          </div>
          {categories.isLoading ? (
            <SkeletonPanel height={260} label="Loading category distribution…" />
          ) : categories.error ? (
            <ErrorNotice error={categories.error} retry={() => void categories.mutate()} />
          ) : distribution.length ? (
            <div className="chart-box tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distribution}
                  layout="vertical"
                  margin={{ top: 8, right: 24, bottom: 8, left: 0 }}
                  accessibilityLayer
                >
                  <CartesianGrid horizontal={false} stroke={palette.grid} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: palette.axis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={narrow ? 104 : 150}
                    tick={{ fontSize: 11, fill: palette.axis }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    {...tooltip}
                    formatter={(value) => [Number(value).toLocaleString(), "Selections"]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                  />
                  <Bar dataKey="value" name="Selections" fill={palette.ok} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No category selections in this period" />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Reporting activity timeline</h2>
              <p>Non-compliance reports submitted per period</p>
            </div>
          </div>
          {trends.isLoading ? (
            <SkeletonPanel height={260} label="Loading reporting activity…" />
          ) : trends.error ? (
            <ErrorNotice error={trends.error} retry={() => void trends.mutate()} />
          ) : t?.points.length ? (
            <div className="chart-box tall">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={t.points} margin={{ top: 12, right: 16, bottom: 5, left: 0 }} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke={palette.grid} />
                  <XAxis
                    dataKey="bucket"
                    tick={{ fontSize: 11, fill: palette.axis }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: palette.axis }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="reportCount" name="Non-compliance reports" fill={palette.warn} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty title="No reporting activity" />
          )}
        </section>
      </div>

      <h2 className="group-heading">Reporting period comparison</h2>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Selected period vs previous period</h2>
            <p>
              {period
                ? `${describePeriod(filters)} compared with ${describePeriod({ from: period.from, to: period.to })} (${period.days} day${period.days === 1 ? "" : "s"} each)`
                : "Choose both a From and a To date above to compare with the period of equal length before it."}
            </p>
          </div>
        </div>
        {!period ? (
          <Empty title="No comparison period selected">
            Comparison needs a start and end date, so nothing is estimated without them.
          </Empty>
        ) : previous?.isLoading ? (
          <SkeletonBars rows={4} label="Loading previous period…" />
        ) : previous?.error ? (
          <ErrorNotice error={previous.error} retry={() => void previous.mutate()} />
        ) : comparisonRows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Measure</th>
                  <th>Selected period</th>
                  <th>Previous period</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => {
                  const d = change(row.now, row.before);
                  return (
                    <tr key={row.label}>
                      <td data-label="Measure"><strong>{row.label}</strong></td>
                      <td data-label="Selected period">{row.now.toLocaleString()}</td>
                      <td data-label="Previous period">{row.before.toLocaleString()}</td>
                      <td data-label="Change">
                        {d.label}
                        {d.percent !== undefined && d.diff !== 0 ? ` (${d.percent > 0 ? "+" : "−"}${Math.abs(d.percent).toFixed(1)}%)` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No comparison data" />
        )}
      </section>

      <h2 className="group-heading">Administrative overview</h2>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2><Users size={17} /> Staff &amp; reporting activity</h2>
            <p>Registered clinical staff and the reports they have submitted</p>
          </div>
          <Link className="text-button" to="/staff">
            Manage staff <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="admin-overview">
          <div className="admin-tile">
            <span>Active staff accounts</span>
            <strong>{summary.isLoading ? <span className="skeleton" /> : s ? s.activeStaffAccounts.toLocaleString() : "—"}</strong>
            <small>Nurses and pharmacists</small>
          </div>
          {staffRows.map(({ label, res }) => {
            const list = res.data?.data ?? [];
            const total = res.data?.meta?.total ?? list.length;
            const complete = total === list.length;
            return (
              <div className="admin-tile" key={label}>
                <span>{label}</span>
                <strong>{res.isLoading ? <span className="skeleton" /> : res.error ? "—" : total.toLocaleString()}</strong>
                <small>
                  {res.error
                    ? "Could not load"
                    : complete
                      ? `${list.filter((u) => u.isActive).length} active · ${list.filter((u) => !u.isActive).length} inactive`
                      : "registered accounts"}
                </small>
              </div>
            );
          })}
          <div className="admin-tile">
            <span>Reports by role</span>
            <strong>{summary.isLoading ? <span className="skeleton" /> : s ? (s.headNurseReports + s.pharmacistReports).toLocaleString() : "—"}</strong>
            <small>{s ? `${s.headNurseReports.toLocaleString()} nurse · ${s.pharmacistReports.toLocaleString()} pharmacist` : "Under selected filters"}</small>
          </div>
        </div>
      </section>
    </>
  );
}
