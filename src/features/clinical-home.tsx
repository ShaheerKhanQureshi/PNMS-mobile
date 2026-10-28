import { Link } from "react-router-dom";
import useSWR from "swr";
import { ScanLine, ArrowRight, ClipboardList, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/session";
import { api } from "../lib/api";
import type { Envelope, Report } from "../lib/types";
import { roleLabels, formatTime } from "../lib/types";
import { Loading, ErrorNotice, Empty } from "../components/ui";
import Dashboard from "./dashboard";
import { StatusBadge } from "./reports";
export default function ClinicalHome() {
  const { user } = useAuth();
  const reports = useSWR<Envelope<Report[]>>(
    "/api/reports?page=1&limit=5&sortBy=submittedAt&sortOrder=desc",
    api,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">
            {user && roleLabels[user.role]} WORKSPACE
          </div>
          <h1>Welcome, {user?.fullName}.</h1>
          <p>
            Your observations make a difference. Let&apos;s make each one count.
          </p>
        </div>
      </div>
      <section className="clinical-hero">
        <div>
          <span className="eyebrow">
            PATIENT CARE, ONE OBSERVATION AT A TIME
          </span>
          <h2>
            Notice it. Record it.
            <br />
            Support better care.
          </h2>
          <p>
            Scan a patient QR code, confirm the MR Number, then record a
            compliant check or report a non-compliance using your approved
            categories.
          </p>
          <Link className="button" to="/new-report">
            <ScanLine size={19} />
            New patient check
            <ArrowRight size={18} />
          </Link>
        </div>
        <ScanLine
          className="hero-scan"
          size={134}
          strokeWidth={0.7}
          aria-hidden="true"
        />
      </section>
      <Dashboard scope="self" />
      <div className="clinical-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Recent checks</h2>
            <Link to="/reports" className="text-button">
              View all <ArrowRight size={15} />
            </Link>
          </div>
          {reports.isLoading ? (
            <Loading />
          ) : reports.error ? (
            <ErrorNotice
              error={reports.error}
              retry={() => void reports.mutate()}
            />
          ) : reports.data?.data.length ? (
            <div className="recent-list">
              {reports.data.data.map((r, index) => (
                <Link to={`/reports?record=${r.id}`} key={r.id}>
                  <span className="list-icon">
                    <ClipboardList size={19} />
                  </span>
                  <div>
                    {/* Your own running number in the order shown; the stored report id is not displayed. */}
                    <strong>
                      {index + 1}. MR {r.mrNumber}
                    </strong>
                    <span>
                      <StatusBadge status={r.checkStatus} />{" "}
                      {r.categories.join(" · ")}
                    </span>
                    <small>{formatTime(r.submittedAt)}</small>
                  </div>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="Your first patient check starts here">
              Submitted checks will appear in your history.
            </Empty>
          )}
        </section>
        <section className="panel guidance">
          <ShieldCheck size={27} />
          <h2>A quick reminder</h2>
          <ol>
            <li>Verify the MR Number against the patient record.</li>
            <li>Choose Compliance, or select only the relevant non-compliance categories.</li>
            <li>Wait for confirmation before scanning the next patient.</li>
          </ol>
          <p>
            This workspace records staff observations. It does not make clinical
            decisions.
          </p>
        </section>
      </div>
    </>
  );
}
