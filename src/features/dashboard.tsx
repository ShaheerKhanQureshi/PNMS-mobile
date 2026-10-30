import { useState } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
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
  Category,
  Filters,
  Report,
  Role,
} from "../lib/types";
import { formatTime, formatLoginTime, roleLabels } from "../lib/types";
import { useAuth } from "../auth/session";
import { ErrorNotice, Empty, SkeletonRows } from "../components/ui";
import ReportFilters from "../components/report-filters";
import { StatusBadge } from "./reports";
import { canViewGraphicalAnalytics } from "./dashboard-visibility";
import {
  GraphicalAnalytics,
  CompliancePerformance,
  AdminInsights,
} from "./analytics-charts";
import { HeadNurseReporting, PharmacistReporting } from "./role-reporting";
import { previousPeriod } from "./period";

const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${value.toFixed(1)}%`;

/**
 * Dashboard.
 *  - scope "admin": organisation-wide (Super Admin), uses /api/dashboard/* with every role / staff filter.
 *  - scope "self":  a Head Nurse's or Pharmacist's OWN activity, uses /api/me/dashboard/* which the server pins to
 *                   the signed-in user. It is embedded in the clinical workspace page.
 * All figures come from the filtered backend queries; nothing is derived from partially loaded rows.
 *
 * Role-based presentation (frontend only, see dashboard-visibility.ts):
 *  - roles in GRAPHICAL_ANALYTICS_ROLES (Super Admin) get the complete graphical analytics;
 *  - Head Nurses get the clinical reporting overview and Pharmacists the pharmacy reporting overview instead.
 * The graphs are not deleted: they are rendered by <GraphicalAnalytics /> and only skipped for other roles.
 */
export default function Dashboard({
  scope = "admin",
}: {
  scope?: "admin" | "self";
}) {
  const admin = scope === "admin";
  const { user } = useAuth();
  const showGraphs = canViewGraphicalAnalytics(user?.role);
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
  // Trend data only feeds the graphs, so it is requested only for roles that see them.
  const trends = useSWR<Envelope<Trends>>(
    showGraphs ? `${base}/trends${queryString({ ...aggregate, interval })}` : null,
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
  // Staff reporting overview: the user's own latest reports in the selected period, and the categories they may use.
  const ownRecent = useSWR<Envelope<Report[]>>(
    !admin && !showGraphs
      ? `/api/reports${queryString({ ...aggregate, page: "1", limit: "6", sortBy: "submittedAt", sortOrder: "desc" })}`
      : null,
    api,
  );
  const categoryList = useSWR<Envelope<Category[]>>(
    !admin && !showGraphs ? "/api/categories?activeOnly=false" : null,
    api,
  );
  // Period comparison: only when both dates are chosen, using the same summary endpoint for the earlier period.
  const period = previousPeriod(aggregate);
  const wantsComparison = showGraphs
    ? admin
    : user?.role === "PHARMACIST";
  const previous = useSWR<Envelope<Summary>>(
    period && wantsComparison
      ? `${base}/summary${queryString({ ...aggregate, from: period.from, to: period.to })}`
      : null,
    api,
  );
  const s = summary.data?.data;
  const selectedRole = admin ? (filters.role as Role | undefined) : user?.role;
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
      {admin && showGraphs && <CompliancePerformance summary={summary} />}
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
      {showGraphs ? (
        <>
          <GraphicalAnalytics
            admin={admin}
            summary={summary}
            trends={trends}
            categories={categories}
            interval={interval}
            setInterval={setInterval}
            selectedRole={selectedRole}
          />
          {admin && (
            <AdminInsights
              summary={summary}
              trends={trends}
              categories={categories}
              previous={period ? previous : undefined}
              period={period}
              filters={aggregate}
              selectedRole={selectedRole}
            />
          )}
        </>
      ) : user?.role === "PHARMACIST" ? (
        <PharmacistReporting
          filters={aggregate}
          summary={summary}
          categories={categories}
          recent={ownRecent}
          previous={period ? previous : undefined}
          roleCategories={(categoryList.data?.data ?? []).filter((c) => c.isActive)}
        />
      ) : user?.role === "HEAD_NURSE" ? (
        <HeadNurseReporting
          filters={aggregate}
          summary={summary}
          categories={categories}
          recent={ownRecent}
          roleCategories={(categoryList.data?.data ?? []).filter((c) => c.isActive)}
        />
      ) : null}
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
            <SkeletonRows rows={5} label="Loading recent responses…" />
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
