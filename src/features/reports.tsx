import { useState } from "react";
import useSWR from "swr";
import { useSearchParams } from "react-router-dom";
import { Download, FileText, ArrowUpRight } from "lucide-react";
import { api, download, queryString } from "../lib/api";
import type { Envelope, Report, Filters } from "../lib/types";
import {
  formatTime,
  formatLoginTime,
  roleLabels,
  checkStatusLabels,
} from "../lib/types";
import { useAuth } from "../auth/session";
import {
  Empty,
  ErrorNotice,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import ReportFilters from "../components/report-filters";
export function StatusBadge({ status }: { status?: Report["checkStatus"] }) {
  const value = status ?? "NON_COMPLIANT";
  return (
    <span
      className={`status-badge ${value === "COMPLIANT" ? "compliant" : "non-compliant"}`}
    >
      {checkStatusLabels[value]}
    </span>
  );
}
function Detail({ id, admin }: { id: number; admin: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<Envelope<Report>>(
    `/api/reports/${id}`,
    api,
  );
  const r = data?.data;
  return isLoading ? (
    <Loading />
  ) : error ? (
    <ErrorNotice error={error} retry={() => void mutate()} />
  ) : r ? (
    <dl className="detail-list">
      {admin && (
        <>
          <dt>Report reference</dt>
          <dd>#{r.id}</dd>
        </>
      )}
      <dt>MR Number</dt>
      <dd className="mono">{r.mrNumber}</dd>
      <dt>Submitted by</dt>
      <dd>
        {r.submittedBy.fullName} · {r.submittedBy.username}
      </dd>
      <dt>Staff role</dt>
      <dd>{roleLabels[r.role]}</dd>
      <dt>Status</dt>
      <dd>
        <StatusBadge status={r.checkStatus} />
      </dd>
      <dt>First login time (PKT)</dt>
      <dd>{formatLoginTime(r.firstLoginAt)}</dd>
      <dt>Submission time (PKT)</dt>
      <dd>{formatTime(r.submittedAt)}</dd>
      <dt>Non-compliance categories</dt>
      <dd>
        {r.categories.length ? (
          r.categories.map((c) => (
            <span className="pill" key={c}>
              {c}
            </span>
          ))
        ) : (
          <span className="muted">None (compliant check)</span>
        )}
      </dd>
      <dt>Remarks</dt>
      <dd className="preserve-text">{r.remarks || "No remarks recorded."}</dd>
    </dl>
  ) : null;
}
export default function Reports() {
  const { user } = useAuth();
  const admin = user?.role === "SUPER_ADMIN";
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState("submittedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [params, setParams] = useSearchParams();
  const raw = params.get("record");
  const selected = raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState<unknown>();
  const reports = useSWR<Envelope<Report[]>>(
    `/api/reports${queryString({ ...filters, page: String(page), limit: String(limit), sortBy, sortOrder })}`,
    api,
  );
  async function exportFile(format: "pdf" | "xlsx") {
    setError(undefined);
    setExporting(format);
    try {
      await download(format, { ...filters, sortBy, sortOrder });
    } catch (e) {
      setError(e);
    } finally {
      setExporting("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">OBSERVATION RECORDS</div>
          <h1>{admin ? "Reports" : "My reports"}</h1>
          <p>
            {admin
              ? "Review, filter, and export authorized patient observations."
              : "A secure history of the observations you have submitted."}
          </p>
        </div>
        {admin && (
          <div className="actions">
            {(["pdf", "xlsx"] as const).map((f) => (
              <button
                className="button secondary"
                disabled={!!exporting}
                key={f}
                onClick={() => void exportFile(f)}
              >
                <Download size={16} />
                {exporting === f
                  ? "Preparing…"
                  : f === "pdf"
                    ? "Export PDF"
                    : "Export Excel"}
              </button>
            ))}
          </div>
        )}
      </div>
      <ErrorNotice error={error} />
      <ReportFilters
        value={filters}
        onApply={(f) => {
          setFilters(f);
          setPage(1);
        }}
        admin={admin}
      />
      <section className="panel">
        <div className="panel-heading">
          <h2>
            <FileText size={18} />
            {admin ? "All observations" : "Your observations"}
          </h2>
          <div className="sort-controls">
            <label>
              Sort by{" "}
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                {Object.entries({
                  submittedAt: "Submission date",
                  id: "Report ID",
                  mrNumber: "MR Number",
                  staffName: "Staff name",
                  role: "Role",
                }).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <select
              aria-label="Sort direction"
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setPage(1);
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
        {reports.isLoading ? (
          <Loading label="Loading observations…" />
        ) : reports.error ? (
          <ErrorNotice
            error={reports.error}
            retry={() => void reports.mutate()}
          />
        ) : !reports.data?.data.length ? (
          <Empty title="No observations found" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>S.No.</th>
                  <th>MR Number</th>
                  {admin && <th>Staff member</th>}
                  <th>Status</th>
                  <th>Categories</th>
                  {admin && <th>First login time (PKT)</th>}
                  <th>Submission time (PKT)</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reports.data.data.map((r, index) => (
                  <tr key={r.id}>
                    {/* Display-only serial in the order shown (continues across pages). The database id is never renumbered. */}
                    <td data-label="S.No.">
                      <strong>{(page - 1) * limit + index + 1}</strong>
                      {admin && (
                        <span className="cell-secondary">ID #{r.id}</span>
                      )}
                    </td>
                    <td data-label="MR Number">
                      <span className="mono">{r.mrNumber}</span>
                    </td>
                    {admin && (
                      <td data-label="Staff">
                        <strong>{r.submittedBy.fullName}</strong>
                        <span className="cell-secondary">
                          @{r.submittedBy.username} · {roleLabels[r.role]}
                        </span>
                      </td>
                    )}
                    <td data-label="Status">
                      <StatusBadge status={r.checkStatus} />
                    </td>
                    <td data-label="Categories">
                      <div className="tags">
                        {r.categories.length ? (
                          r.categories.map((c) => (
                            <span className="pill" key={c}>
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </div>
                    </td>
                    {admin && (
                      <td data-label="First login time (PKT)">
                        {formatLoginTime(r.firstLoginAt)}
                      </td>
                    )}
                    <td data-label="Submission time (PKT)">
                      {formatTime(r.submittedAt)}
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setParams({ record: String(r.id) })}
                        aria-label={`View report ${r.id}`}
                      >
                        Details <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          meta={reports.data?.meta}
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={(v) => {
            setLimit(v);
            setPage(1);
          }}
        />
      </section>
      {selected && (
        <Modal title="Observation details" onClose={() => setParams({})}>
          <Detail id={selected} admin={admin} />
        </Modal>
      )}
    </>
  );
}
