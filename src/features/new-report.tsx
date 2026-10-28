import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { Link } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ArrowRight,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { api, ApiError, mutateApi } from "../lib/api";
import type {
  Category,
  CheckStatus,
  Envelope,
  Report,
  ReportInput,
} from "../lib/types";
import {
  roleLabels,
  formatDate,
  formatClock,
  formatLoginTime,
} from "../lib/types";
import { useAuth } from "../auth/session";
import { ErrorNotice, Loading } from "../components/ui";
import { policy } from "../lib/validation";
import Scanner from "./scanner";
export default function NewReport() {
  const { user } = useAuth();
  const categories = useSWR<Envelope<Category[]>>(
    "/api/categories?activeOnly=true",
    api,
  );
  const [mr, setMr] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  // Outcome of the patient check, chosen after the MR Number is confirmed.
  const [outcome, setOutcome] = useState<CheckStatus>();
  const [selected, setSelected] = useState<number[]>([]);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState<Report>();
  const attempt = useRef<{ key: string; body: ReportInput } | undefined>(
    undefined,
  );
  const lock = useRef(false);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (uncertain || submitting) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uncertain, submitting]);
  async function submit() {
    if (
      lock.current ||
      !confirmed ||
      !outcome ||
      (outcome === "NON_COMPLIANT" && !selected.length)
    )
      return;
    lock.current = true;
    setSubmitting(true);
    setError(undefined);
    if (!attempt.current)
      attempt.current = {
        key: crypto.randomUUID(),
        body: {
          mrNumber: mr,
          checkStatus: outcome,
          // A compliant check never carries non-compliance categories.
          ...(outcome === "NON_COMPLIANT"
            ? { categoryIds: [...new Set(selected)] }
            : {}),
          ...(policy.remarks && remarks.trim()
            ? { remarks: remarks.trim() }
            : {}),
        },
      };
    try {
      const result = await mutateApi<Report>(
        "/api/reports",
        "POST",
        attempt.current.body,
        { "Idempotency-Key": attempt.current.key },
      );
      setSaved(result.data);
      setUncertain(false);
      attempt.current = undefined;
    } catch (e) {
      setError(e);
      const unknown =
        !(e instanceof ApiError) || e.status === 0 || e.status >= 500;
      setUncertain(unknown);
      if (!unknown) attempt.current = undefined;
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }
  function reset() {
    setMr("");
    setConfirmed(false);
    setOutcome(undefined);
    setSelected([]);
    setRemarks("");
    setSaved(undefined);
    setError(undefined);
    attempt.current = undefined;
  }
  if (saved)
    return (
      <div className="narrow-page">
        <div className="panel success-panel">
          <CheckCircle2 size={56} />
          <div className="eyebrow muted">
            {saved.checkStatus === "COMPLIANT"
              ? "COMPLIANCE CHECK RECORDED"
              : "NON-COMPLIANCE RECORDED"}
          </div>
          <h1>Thank you for looking out.</h1>
          <p>
            {saved.checkStatus === "COMPLIANT"
              ? "The patient check was saved as compliant."
              : "Your report has been saved successfully."}
          </p>
          <div className="confirmation-box">
            <span>MR Number</span>
            <strong className="mono">{saved.mrNumber}</strong>
            <span>Result</span>
            <strong>
              {saved.checkStatus === "COMPLIANT"
                ? "Compliant — no non-compliance found"
                : "Non-compliant — issue identified"}
            </strong>
            {saved.categories.length > 0 && (
              <>
                <span>Non-compliance categories</span>
                <strong>{saved.categories.join(", ")}</strong>
              </>
            )}
            <span>Submitted by</span>
            <strong>{saved.submittedBy?.fullName ?? user?.fullName}</strong>
            <span>Username</span>
            <strong>{saved.submittedBy?.username ?? user?.username}</strong>
            <span>Role</span>
            <strong>
              {(() => {
                const role = saved.role ?? user?.role;
                return role ? roleLabels[role] : "—";
              })()}
            </strong>
            <span>Submission date</span>
            <strong>{formatDate(saved.submittedAt)}</strong>
            <span>Submission time</span>
            <strong>{formatClock(saved.submittedAt)}</strong>
            <span>First login today</span>
            <strong>{formatLoginTime(saved.firstLoginAt)}</strong>
          </div>
          <button className="button" onClick={reset}>
            <ScanLine size={18} />
            Scan next patient
          </button>
          <Link className="text-button" to="/reports">
            View my reports <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    );
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">
            {user && roleLabels[user.role]} WORKSPACE
          </div>
          <h1>New patient check</h1>
          <p>Record that a patient was compliant, or report a non-compliance.</p>
        </div>
      </div>
      <ol className="stepper">
        {["Identify patient", "Confirm MR Number", "Record check"].map(
          (s, i) => (
            <li
              className={i <= (outcome ? 2 : mr ? 1 : 0) ? "active" : ""}
              key={s}
            >
              <span>
                {i < (outcome ? 2 : mr ? 1 : 0) ? <Check size={15} /> : i + 1}
              </span>
              {s}
            </li>
          ),
        )}
      </ol>
      <div className="panel form-panel">
        {!mr ? (
          <>
            <h2>Scan the patient QR code</h2>
            <Scanner
              onDetected={(value) => {
                setMr(value);
                setError(undefined);
              }}
            />
          </>
        ) : !confirmed ? (
          <div className="verify-patient">
            <ShieldCheck size={34} />
            <h2>Confirm the MR Number</h2>
            <p>
              Check this number against the patient record before continuing.
            </p>
            <div className="mr-display">{mr}</div>
            <p className="hint">
              This confirms the identifier only, not the patient&apos;s clinical
              information.
            </p>
            <div className="actions">
              <button className="button secondary" onClick={reset}>
                Rescan
              </button>
              <button className="button" onClick={() => setConfirmed(true)}>
                Confirm and continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="report-identity">
              <div>
                <span>MR NUMBER</span>
                <strong className="mono">{mr}</strong>
              </div>
              <div>
                <span>REPORTED BY</span>
                <strong>{user?.fullName}</strong>
                <small>{user && roleLabels[user.role]}</small>
              </div>
            </div>
            <h2>Check result</h2>
            <p className="hint">
              Choose the outcome of this patient check.
            </p>
            <fieldset
              className="outcome-grid"
              disabled={submitting || uncertain}
            >
              <legend className="sr-only">Check result</legend>
              {(
                [
                  [
                    "COMPLIANT",
                    "Compliance — No Non-Compliance Found",
                    "The patient was checked and everything was compliant.",
                  ],
                  [
                    "NON_COMPLIANT",
                    "Non-Compliance — Issue Identified",
                    "Select the non-compliance categories you observed.",
                  ],
                ] as const
              ).map(([value, title, note]) => (
                <label
                  key={value}
                  className={`outcome-option ${value === "COMPLIANT" ? "compliant" : "non-compliant"} ${outcome === value ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="check-outcome"
                    value={value}
                    checked={outcome === value}
                    onChange={() => setOutcome(value)}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{note}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {outcome === "NON_COMPLIANT" && (
              <>
            <h2>Select Non-Compliance Categories</h2>
            <p className="hint">
              Select every non-compliance category that applies. Only
              categories approved for your role are shown; at least one is
              required.
            </p>
            {categories.isLoading ? (
              <Loading />
            ) : categories.error ? (
              <ErrorNotice
                error={categories.error}
                retry={() => void categories.mutate()}
              />
            ) : (
              <fieldset
                className="category-grid"
                disabled={submitting || uncertain}
              >
                <legend className="sr-only">Observation categories</legend>
                {categories.data?.data
                  .filter((c) => c.allowedRole === user?.role && c.isActive)
                  .map((category) => (
                    <label
                      key={category.id}
                      className={`category-option ${selected.includes(category.id) ? "selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(category.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, category.id]
                              : selected.filter((id) => id !== category.id),
                          )
                        }
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
              </fieldset>
            )}
              </>
            )}
            {outcome && policy.remarks && (
              <label className="field">
                Remarks (optional)
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={policy.remarksMaxLength}
                  disabled={submitting || uncertain}
                  rows={4}
                />
                <small>
                  Record only relevant observations. Do not include additional
                  patient-identifying details. {remarks.length}/
                  {policy.remarksMaxLength}
                </small>
              </label>
            )}
            <ErrorNotice error={error} />
            {uncertain && (
              <div className="notice">
                The submission outcome is uncertain. Keep this page open and
                retry below; the same request key will be used to avoid a
                duplicate. Do not start a new report for this observation.
              </div>
            )}
            <div className="actions">
              <button
                className="button secondary"
                disabled={submitting || uncertain}
                onClick={() => setConfirmed(false)}
              >
                Back
              </button>
              <button
                className="button"
                disabled={
                  submitting ||
                  !outcome ||
                  (outcome === "NON_COMPLIANT" &&
                    (!selected.length || !!categories.error))
                }
                onClick={() => void submit()}
              >
                {submitting
                  ? "Saving…"
                  : uncertain
                    ? "Safely retry submission"
                    : outcome === "COMPLIANT"
                      ? "Submit compliant check"
                      : "Submit non-compliance report"}
                <ArrowRight size={17} />
              </button>
            </div>
            <p className="hint">
              Your staff identity and submission time are recorded by the
              server.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
