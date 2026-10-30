import {
  Component,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react";
import type { Meta } from "../lib/types";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <img
        className="brand-logo"
        src="/images/clf-logo.webp"
        alt="ChildLife Foundation"
        width={180}
        height={111}
      />
      <span className="brand-divider" />
      <span className="brand-caption">
        Patient care.
        <br />
        Shared responsibility.
      </span>
    </div>
  );
}
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={20} />
      {label}
    </div>
  );
}
/** Subtle placeholder shaped like the content it stands in for. Decorative: the surrounding region announces loading. */
export function Skeleton({
  width = "100%",
  height = 14,
  radius,
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span
      className={`skeleton-block ${className}`}
      aria-hidden="true"
      style={{ width, height, borderRadius: radius }}
    />
  );
}
/** Placeholder for a list of two-line rows (recent checks, recent reports). */
export function SkeletonRows({
  rows = 4,
  label = "Loading…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="skeleton-rows" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <Skeleton width={38} height={38} radius={8} />
          <div>
            <Skeleton width="46%" height={12} />
            <Skeleton width="72%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
/** Placeholder for a panel body that will hold a chart or a set of bars. */
export function SkeletonPanel({
  height = 220,
  label = "Loading…",
}: {
  height?: number;
  label?: string;
}) {
  return (
    <div className="skeleton-panel" role="status" aria-label={label}>
      <Skeleton width="100%" height={height} radius={8} />
    </div>
  );
}
/** Placeholder for category bars: a label line over a thin track, repeated. */
export function SkeletonBars({
  rows = 5,
  label = "Loading…",
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div className="skeleton-bars" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i}>
          <Skeleton width={`${60 - i * 6}%`} height={11} />
          <Skeleton width="100%" height={6} radius={4} />
        </div>
      ))}
    </div>
  );
}
export function ErrorNotice({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="notice error">
      <AlertCircle size={19} />
      <div>
        {error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."}
        {error instanceof Error &&
          "details" in error &&
          Array.isArray(error.details) &&
          error.details.length > 0 && (
            <ul>
              {error.details.map(
                (detail: { path: string; message: string }, index: number) => (
                  <li key={index}>
                    {detail.path}: {detail.message}
                  </li>
                ),
              )}
            </ul>
          )}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "No records found",
  children,
  icon,
}: {
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ?? <ShieldCheck size={30} />}
      <h3>{title}</h3>
      <p>{children || "Try adjusting your filters."}</p>
    </div>
  );
}
export function Field({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = props.id || props.name;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : props["aria-describedby"]}
      />
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
export function PasswordField({
  label = "Password",
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const [visible, setVisible] = useState(false);
  const id = props.id || props.name;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="password-input">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="icon-button"
          aria-label={
            visible
              ? `Hide ${label.toLowerCase()}`
              : `Show ${label.toLowerCase()}`
          }
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {error && (
        <small className="field-error" id={`${id}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={onClose}
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pagination({
  meta,
  page,
  setPage,
  limit,
  setLimit,
}: {
  meta?: Meta;
  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {meta
          ? `${meta.total.toLocaleString()} records · Page ${meta.totalPages ? page : 0} of ${meta.totalPages}`
          : "Loading records"}
      </span>
      <div>
        <label>
          Per page{" "}
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button
          aria-label="Previous page"
          className="button secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          aria-label="Next page"
          className="button secondary"
          disabled={!meta || page >= meta.totalPages}
          onClick={() => setPage(page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="recovery">
        <h1>We couldn&apos;t display this page.</h1>
        <p>
          No changes have been confirmed. Reload the application to reconnect.
        </p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload application
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
