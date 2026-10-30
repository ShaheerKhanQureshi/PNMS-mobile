import useSWR from "swr";
import { Activity, Database, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { Loading, ErrorNotice } from "../components/ui";
import type { Envelope } from "../lib/types";
export default function Status() {
  const live = useSWR<Envelope<{ status: string }>>("/health/live", api);
  const ready = useSWR<Envelope<{ status: string }>>("/health/ready", api);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">SERVICE AVAILABILITY</div>
          <h1>System status</h1>
          <p>On-demand health checks for authorized administrators.</p>
        </div>
        <button
          className="button secondary"
          disabled={live.isValidating || ready.isValidating}
          onClick={() => {
            void live.mutate();
            void ready.mutate();
          }}
        >
          <RefreshCw size={16} />
          Run checks
        </button>
      </div>
      <div className="clinical-grid">
        {[
          {
            title: "Application service",
            query: live,
            expected: "ok",
            Icon: Activity,
          },
          {
            title: "Database readiness",
            query: ready,
            expected: "ready",
            Icon: Database,
          },
        ].map(({ title, query, expected, Icon }) => (
          <section className="panel form-panel" key={title}>
            <Icon size={26} />
            <h2>{title}</h2>
            {query.isLoading ? (
              <Loading label="Checking service…" />
            ) : query.error ? (
              <ErrorNotice error={query.error} />
            ) : (
              <div
                className={`notice ${query.data?.data.status === expected ? "success" : ""}`}
              >
                {query.data?.data.status === expected
                  ? "Available"
                  : "Not ready"}
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="hint">
        These checks report availability only. They do not certify security,
        backups, or production readiness.
      </p>
    </>
  );
}
