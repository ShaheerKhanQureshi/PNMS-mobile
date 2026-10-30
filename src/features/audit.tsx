import { useState } from "react";
import useSWR from "swr";
import { ShieldCheck } from "lucide-react";
import { api, queryString } from "../lib/api";
import type { Envelope, Audit, Filters } from "../lib/types";
import { formatTime } from "../lib/types";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
const actions = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "PASSWORD_CHANGED",
  "PASSWORD_CHANGE_FAILED",
  "REPORT_CREATED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_ACTIVATED",
  "USER_DEACTIVATED",
  "USER_PASSWORD_RESET",
  "EXPORT_PDF",
  "EXPORT_XLSX",
  "AUTHZ_DENIED",
  "CSRF_REJECTED",
  "ADMIN_PROVISIONED",
];
export default function AuditLogs() {
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selected, setSelected] = useState<Audit>();
  const [error, setError] = useState<unknown>();
  const entries = useSWR<Envelope<Audit[]>>(
    `/api/audit-logs${queryString({ ...filters, page: String(page), limit: String(limit) })}`,
    api,
  );
  const change = (key: string, value: string) =>
    setDraft({ ...draft, [key]: value });
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">SECURITY & ACCOUNTABILITY</div>
          <h1>Audit trail</h1>
          <p>A read-only record of system access and authorized activity.</p>
        </div>
        <span className="pill">
          <ShieldCheck size={14} />
          Administrator access
        </span>
      </div>
      <form
        className="panel filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.from && draft.to && draft.from > draft.to) {
            setError(new Error("Start date must not be after end date."));
            return;
          }
          setError(undefined);
          setFilters(draft);
          setPage(1);
        }}
      >
        <div className="filter-grid">
          <Field
            label="From date"
            name="from"
            type="date"
            value={draft.from || ""}
            onChange={(e) => change("from", e.target.value)}
          />
          <Field
            label="To date"
            name="to"
            type="date"
            value={draft.to || ""}
            onChange={(e) => change("to", e.target.value)}
          />
          <label className="field">
            Action
            <select
              value={draft.action || ""}
              onChange={(e) => change("action", e.target.value)}
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Outcome
            <select
              value={draft.outcome || ""}
              onChange={(e) => change("outcome", e.target.value)}
            >
              <option value="">All outcomes</option>
              {["SUCCESS", "FAILURE", "DENIED"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <Field
            label="Actor user ID"
            name="actorUserId"
            type="number"
            min={1}
            max={2147483647}
            value={draft.actorUserId || ""}
            onChange={(e) => change("actorUserId", e.target.value)}
          />
          <Field
            label="Entity type"
            name="entityType"
            maxLength={64}
            value={draft.entityType || ""}
            onChange={(e) => change("entityType", e.target.value)}
          />
          <label className="field">
            Order
            <select
              value={draft.sortOrder || "desc"}
              onChange={(e) => change("sortOrder", e.target.value)}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </label>
          <button className="button secondary">Apply filters</button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setDraft({});
              setFilters({});
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>
        <ErrorNotice error={error} />
      </form>
      <section className="panel">
        {entries.isLoading ? (
          <Loading />
        ) : entries.error ? (
          <ErrorNotice
            error={entries.error}
            retry={() => void entries.mutate()}
          />
        ) : !entries.data?.data.length ? (
          <Empty title="No matching audit events" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Outcome</th>
                  <th>Time</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.data.data.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Event">
                      <strong>{a.action.replaceAll("_", " ")}</strong>
                      <span className="cell-secondary">
                        {a.entityType} {a.entityId ? `#${a.entityId}` : ""}
                      </span>
                    </td>
                    <td data-label="Actor">
                      {a.actor?.fullName || "System / unauthenticated"}
                    </td>
                    <td data-label="Outcome">
                      <span
                        className={`pill ${a.outcome === "SUCCESS" ? "active-pill" : "warning-pill"}`}
                      >
                        {a.outcome}
                      </span>
                    </td>
                    <td data-label="Time">{formatTime(a.createdAt)}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(a)}
                      >
                        View event
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          meta={entries.data?.meta}
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
        <Modal
          title={`Audit event #${selected.id}`}
          onClose={() => setSelected(undefined)}
        >
          <dl className="detail-list">
            <dt>Action</dt>
            <dd>{selected.action}</dd>
            <dt>Actor</dt>
            <dd>{selected.actor?.fullName || "System / unauthenticated"}</dd>
            <dt>Outcome</dt>
            <dd>{selected.outcome}</dd>
            <dt>Timestamp</dt>
            <dd>{formatTime(selected.createdAt)}</dd>
            <dt>Request reference</dt>
            <dd className="mono">{selected.requestId}</dd>
            <dt>Server-authorized metadata</dt>
            <dd>
              <pre>{JSON.stringify(selected.details || {}, null, 2)}</pre>
            </dd>
          </dl>
        </Modal>
      )}
    </>
  );
}
