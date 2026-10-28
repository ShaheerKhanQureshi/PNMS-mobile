import { useState } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
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
import {
  ClipboardList,
  Users,
  CalendarDays,
  Stethoscope,
  Pill,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Percent,
} from "lucide-react";
import { api, queryString } from "../lib/api";
import type {
  Envelope,
  Summary,
  Trends,
  CategoryStats,
  Filters,
  Report,
  Role,
} from "../lib/types";
import {
  formatTime,
  formatLoginTime,
  roleLabels,
} from "../lib/types";
import { useAuth } from "../auth/session";
import { ErrorNotice, Loading, Empty } from "../components/ui";
import ReportFilters from "../components/report-filters";
import { StatusBadge } from "./reports";

const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

/**
 * Analytics dashboard.
 *  - scope "admin": organisation-wide (Super Admin), uses /api/dashboard/* with every role / staff filter.
 *  - scope "self":  a Head Nurse's or Pharmacist's OWN activity, uses /api/me/dashboard/* which the server pins to
 *                   the signed-in user. It is embedded in the clinical workspace page.
 * All figures come from the filtered backend queries; nothing is derived from partially loaded rows.
 */
export default function Dashboard({
  scope = "admin",
}: {
  scope?: "admin" | "self";
}) {
  const admin = scope === "admin";
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [interval, setInterval] = useState("daily");
  const base = admin ? "/api/dashboard" : "/api/me/dashboard";
  // The aggregate endpoints show compliant AND non-compliant checks side by side, so the check-type filter (used by
  // the report table and exports) is not sent to them. Self endpoints accept only from / to / categoryId.
  const aggregate: Filters = admin
    ? Object.fromEntries(
        Object.entries(filters).filter(([key]) => key !== "checkStatus"),
      )
    : Object.fromEntries(
        Object.entries(filters).filter(([key]) =>
          ["from", "to", "categoryId"].includes(key),
        ),
      );
  const summary = useSWR<Envelope<Summary>>(
    `${base}/summary${queryString(aggregate)}`,
    api,
  );
  const trends = useSWR<Envelope<Trends>>(
    `${base}/trends${queryString({ ...aggregate, interval })}`,
    api,
  );
  const categories = useSWR<Envelope<CategoryStats>>(
    `${base}/categories${queryString(aggregate)}`,
    api,
  );
  // Latest submitted checks under the same filters (Super Admin only; staff have their own history list).
  const recent = useSWR<Envelope<Report[]>>(
    admin
      ? `/api/reports${queryString({ ...filters, page: "1", limit: "10", sortBy: "submittedAt", sortOrder: "desc" })}`
      : null,
    api,
  );
  const s = summary.data?.data;
  const t = trends.data?.data;
  const c = categories.data?.data;
  const selectedRole = admin ? (filters.role as Role | undefined) : user?.role;
  const roleData = s
    ? [
        { name: "Head Nurse", role: "HEAD_NURSE", value: s.headNurseReports },
        { name: "Pharmacist", role: "PHARMACIST", value: s.pharmacistReports },
      ].filter((r) => !selectedRole || r.role === selectedRole)
    : [];
  const outcomeData = s
    ? [
        { name: "Compliant", value: s.compliantChecks, color: "#26745b" },
        { name: "Non-compliant", value: s.nonCompliantChecks, color: "#c98a3c" },
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
  const statCards = [
    ...(admin
      ? [
          {
            key: "totalReports",
            label: "Non-compliance reports",
            icon: ClipboardList,
            note: "Distinct reports · compliant checks excluded",
          },
          ...(!selectedRole || selectedRole === "HEAD_NURSE"
            ? [
                {
                  key: "headNurseReports",
                  label: "Head Nurse reports",
                  icon: Stethoscope,
                  note: "Under selected filters",
                },
              ]
            : []),
          ...(!selectedRole || selectedRole === "PHARMACIST"
            ? [
                {
                  key: "pharmacistReports",
                  label: "Pharmacist reports",
                  icon: Pill,
                  note: "Under selected filters",
                },
              ]
            : []),
        ]
      : [
          {
            key: "totalReports",
            label: "My non-compliance reports",
            icon: ClipboardList,
            note: "Distinct reports you submitted",
          },
        ]),
    {
      key: "reportsToday",
      label: admin ? "Submitted today" : "Reports today",
      icon: CalendarDays,
      note: "Pakistan day · date filters excluded",
    },
    {
      key: "reportsThisMonth",
      label: "This month",
      icon: CalendarDays,
      note: "Pakistan month · date filters excluded",
    },
    ...(admin
      ? [
          {
            key: "activeStaffAccounts",
            label: "Active staff",
            icon: Users,
            note: selectedRole
              ? "Active accounts in the selected role"
              : "Nurses and pharmacists",
          },
        ]
      : []),
  ];
  const checkCards = [
    {
      key: "totalChecks",
      label: admin ? "Total check events" : "My total checks",
      icon: Activity,
      note: "Every completed check; one patient can be checked more than once",
      text: (v: Summary) => v.totalChecks.toLocaleString(),
    },
    {
      key: "compliantChecks",
      label: "Compliant checks",
      icon: ShieldCheck,
      note: "No non-compliance found",
      text: (v: Summary) => v.compliantChecks.toLocaleString(),
    },
    {
      key: "nonCompliantChecks",
      label: "Non-compliant checks",
      icon: ShieldAlert,
      note: "Issue identified",
      text: (v: Summary) => v.nonCompliantChecks.toLocaleString(),
    },
    {
      key: "complianceRate",
      label: "Compliance rate",
      icon: Percent,
      note: "Compliant ÷ total check events",
      text: (v: Summary) => percent(v.complianceRate),
    },
    {
      key: "nonComplianceRate",
      label: "Non-compliance rate",
      icon: Percent,
      note: "Non-compliant ÷ total check events",
      text: (v: Summary) => percent(v.nonComplianceRate),
    },
  ];
  return (
    <>
      {admin ? (
        <div className="page-heading">
          <div>
            <div className="eyebrow muted">MANAGEMENT OVERVIEW</div>
            <h1>A clearer picture of care.</h1>
            <p>Monitor patient checks and support your clinical teams.</p>
          </div>
          <RefreshButton
            busy={
              summary.isValidating ||
              trends.isValidating ||
              categories.isValidating ||
              recent.isValidating
            }
            onClick={() => {
              void recent.mutate();
              void summary.mutate();
              void trends.mutate();
              void categories.mutate();
            }}
          />
        </div>
      ) : (
        <div className="section-heading">
          <div>
            <h2>Your reporting activity</h2>
            <p>Only your own checks and reports are included.</p>
          </div>
          <RefreshButton
            busy={
              summary.isValidating ||
              trends.isValidating ||
              categories.isValidating
            }
            onClick={() => {
              void summary.mutate();
              void trends.mutate();
              void categories.mutate();
            }}
          />
        </div>
      )}
      <ReportFilters
        value={filters}
        onApply={setFilters}
        admin={admin}
        checkType={false}
      />
      <ErrorNotice error={summary.error} retry={() => void summary.mutate()} />
      <h2 className="group-heading">Patient checks</h2>
      <div className="stats-grid checks-grid">
        {checkCards.map(({ key, label, icon: Icon, note, text }) => (
          <section className="panel stat" key={key}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>
              {summary.isLoading ? (
                <span className="skeleton" />
              ) : s ? (
                text(s)
              ) : (
                "—"
              )}
            </strong>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <h2 className="group-heading">Non-compliance reports</h2>
      <div className="stats-grid">
        {statCards.map(({ key, label, icon: Icon, note }) => (
          <section className="panel stat" key={key}>
            <div>
              <span>{label}</span>
              <Icon size={18} />
            </div>
            <strong>
              {summary.isLoading ? (
                <span className="skeleton" />
              ) : s ? (
                Number(s[key as keyof Summary]).toLocaleString()
              ) : (
                "—"
              )}
            </strong>
            <small>{note}</small>
          </section>
        ))}
      </div>
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
            <Loading />
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
                    <CartesianGrid vertical={false} stroke="#e7ede9" />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.slice(5)}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={30}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <Tooltip />
                    <Legend verticalAlign="top" height={28} />
                    <Area
                      type="monotone"
                      dataKey="compliantCount"
                      name="Compliant checks"
                      stroke="#26745b"
                      fill="#e7f0e9"
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="reportCount"
                      name="Non-compliance reports"
                      stroke="#c98a3c"
                      fill="#faefdc"
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
              <Loading />
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
                      <Tooltip />
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
                <Loading />
              ) : s?.totalReports ? (
                <div className="legend">
                  {roleData.map((r, i) => (
                    <div key={r.name}>
                      <span>
                        <i style={{ background: i ? "#a9bd9a" : "#26745b" }} />
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
                  {admin
                    ? section.title
                    : "Your non-compliance categories"}
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
              <Loading />
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
                      <strong>
                        {category.selectionCount.toLocaleString()}
                      </strong>
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
      {admin && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent responses</h2>
              <p>Latest checks with the staff member who submitted them.</p>
            </div>
            <Link className="text-button" to="/reports">
              All reports <ArrowUpRight size={16} />
            </Link>
          </div>
          {recent.isLoading ? (
            <Loading />
          ) : recent.error ? (
            <ErrorNotice
              error={recent.error}
              retry={() => void recent.mutate()}
            />
          ) : !recent.data?.data.length ? (
            <Empty title="No responses yet" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Staff member</th>
                    <th>Role</th>
                    <th>MR Number</th>
                    <th>First login time (PKT)</th>
                    <th>Submission time (PKT)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data.data.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Staff member">
                        <strong>{r.submittedBy.fullName}</strong>
                        <span className="cell-secondary">
                          @{r.submittedBy.username}
                        </span>
                      </td>
                      <td data-label="Role">{roleLabels[r.role]}</td>
                      <td data-label="MR Number">
                        <span className="mono">{r.mrNumber}</span>
                      </td>
                      <td data-label="First login time (PKT)">
                        {formatLoginTime(r.firstLoginAt)}
                      </td>
                      <td data-label="Submission time (PKT)">
                        {formatTime(r.submittedAt)}
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={r.checkStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {s && (
        <p className="hint">
          Last retrieved: {formatTime(s.asOf)} · Counts are supplied by the
          reporting service.
        </p>
      )}
    </>
  );
}
function RefreshButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button className="button secondary" disabled={busy} onClick={onClick}>
      <RefreshCw size={16} />
      Refresh data
    </button>
  );
}
