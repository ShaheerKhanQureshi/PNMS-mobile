import type { Role } from "../lib/types";

/**
 * TEMPORARY PRESENTATION DECISION (frontend only).
 *
 * Roles listed here see the graph-based analytics (Submission trends, Check outcomes, Non-compliance category
 * visualisations, period comparisons, administrative overview). Every other role sees the operational reporting
 * dashboard instead (see role-reporting.tsx).
 *
 * To restore the graphs for Head Nurses and Pharmacists, add "HEAD_NURSE" and/or "PHARMACIST" to this list.
 * Nothing else needs to change: the chart components, their data fetching and their configuration are untouched.
 *
 * This is NOT an access-control mechanism. The API enforces authorisation; this only chooses what is rendered.
 */
export const GRAPHICAL_ANALYTICS_ROLES: readonly Role[] = ["SUPER_ADMIN"];

export const canViewGraphicalAnalytics = (role?: Role): boolean =>
  role !== undefined && GRAPHICAL_ANALYTICS_ROLES.includes(role);
