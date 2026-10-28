export type Role = "HEAD_NURSE" | "PHARMACIST" | "SUPER_ADMIN";
export interface User {
  id: number;
  fullName: string;
  username: string;
  role: Role;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}
export interface Session {
  user: User;
  csrfToken: string;
  session?: { idleTimeoutMinutes: number; absoluteExpiresAt: string };
}
export interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Envelope<T> {
  success: true;
  data: T;
  meta?: Meta;
  message?: string;
}
export interface Category {
  id: number;
  name: string;
  allowedRole: Role;
  isActive: boolean;
}
export type CheckStatus = "COMPLIANT" | "NON_COMPLIANT";
export const checkStatusLabels: Record<CheckStatus, string> = {
  COMPLIANT: "Compliant",
  NON_COMPLIANT: "Non-Compliant",
};
export interface Report {
  id: number;
  mrNumber: string;
  submittedBy: Pick<User, "id" | "fullName" | "username" | "role">;
  role: Role;
  /** Outcome of the patient check. Compliant checks have no categories. */
  checkStatus?: CheckStatus;
  categories: string[];
  categoryIds: number[];
  remarks: string | null;
  submittedAt: string;
  /** UTC sign-in time of the submitting session; null for reports created before it was recorded. */
  submitterLoginAt?: string | null;
  /** UTC time of the staff member's FIRST successful login on the Pakistan calendar date of the submission; null if none is recorded. */
  firstLoginAt?: string | null;
}
export interface ReportInput {
  mrNumber: string;
  checkStatus?: CheckStatus;
  categoryIds?: number[];
  remarks?: string;
}
export interface Summary {
  totalReports: number;
  headNurseReports: number;
  pharmacistReports: number;
  reportsToday: number;
  reportsThisMonth: number;
  activeStaffAccounts: number;
  totalCategorySelections: number;
  /** Check events (compliant + non-compliant). Not unique patients. */
  totalChecks: number;
  compliantChecks: number;
  nonCompliantChecks: number;
  /** Percent of completed check events, one decimal; null when there are no checks. */
  complianceRate: number | null;
  nonComplianceRate: number | null;
  timezoneOffset: string;
  asOf: string;
}
export interface Trends {
  interval: string;
  points: {
    bucket: string;
    reportCount: number;
    categorySelectionCount: number;
    checkCount: number;
    compliantCount: number;
    nonCompliantCount: number;
  }[];
  totals: {
    totalReports: number;
    totalCategorySelections: number;
    totalChecks: number;
    compliantChecks: number;
    nonCompliantChecks: number;
  };
  timezoneOffset: string;
  from: string;
  to: string;
}
export interface CategoryStats {
  categories: {
    categoryId: number;
    name: string;
    allowedRole: Role;
    selectionCount: number;
  }[];
  totals: { totalReports: number; totalCategorySelections: number };
}
export interface Audit {
  id: number;
  actorUserId: number | null;
  actor: { fullName: string; username: string } | null;
  action: string;
  outcome: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  requestId: string;
  details: Record<string, unknown> | null;
}
export type Filters = Record<string, string>;
export const roleLabels: Record<Role, string> = {
  HEAD_NURSE: "Head Nurse",
  PHARMACIST: "Pharmacist",
  SUPER_ADMIN: "Super Administrator",
};
/**
 * Every date and time shown in the interface is displayed in Pakistan Standard Time (UTC+05:00, no daylight
 * saving). The API and the database keep UTC; only the presentation converts.
 */
export const DISPLAY_TIME_ZONE = "Asia/Karachi";
export const DISPLAY_TIME_ZONE_LABEL = "PKT";
const NOT_AVAILABLE = "Not Available";
/**
 * One fixed, locale-independent format: "23-Oct-2026 10:30 AM PKT". The UTC instant is converted exactly once, by
 * Intl with the IANA zone Asia/Karachi (no manual offset arithmetic, so no double conversion).
 */
interface Parts {
  date: string;
  clock: string;
}
function inDisplayZone(value: string | null | undefined): Parts | undefined {
  if (!value) return undefined;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return undefined;
  const get = new Map(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DISPLAY_TIME_ZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value] as const),
  );
  const period = (get.get("dayPeriod") ?? "").toUpperCase();
  return {
    date: `${get.get("day")}-${get.get("month")}-${get.get("year")}`,
    clock: `${get.get("hour")}:${get.get("minute")} ${period} ${DISPLAY_TIME_ZONE_LABEL}`,
  };
}
/** "23-Oct-2026 10:30 AM PKT" */
export const formatTime = (value: string | null | undefined) => {
  const p = inDisplayZone(value);
  return p ? `${p.date} ${p.clock}` : NOT_AVAILABLE;
};
/** "23-Oct-2026" (Pakistan calendar date). */
export const formatDate = (value: string | null | undefined) =>
  inDisplayZone(value)?.date ?? NOT_AVAILABLE;
/** "10:30 AM PKT" */
export const formatClock = (value: string | null | undefined) =>
  inDisplayZone(value)?.clock ?? NOT_AVAILABLE;
/** Session sign-in time. Reports created before it was recorded have none; it is never guessed. */
export const formatLoginTime = (value: string | null | undefined) =>
  value ? formatTime(value) : NOT_AVAILABLE;
