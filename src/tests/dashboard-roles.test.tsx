import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import Dashboard from "../features/dashboard";
import {
  canViewGraphicalAnalytics,
  GRAPHICAL_ANALYTICS_ROLES,
} from "../features/dashboard-visibility";
import {
  previousPeriod,
  describePeriod,
  change,
} from "../features/period";
import { workspaceLabels } from "../lib/types";

const mocks = vi.hoisted(() => ({
  role: "HEAD_NURSE" as "HEAD_NURSE" | "PHARMACIST" | "SUPER_ADMIN",
  api: vi.fn(),
}));
vi.mock("../auth/session", () => ({
  useAuth: () => ({
    user: {
      id: 5,
      fullName: "Synthetic User",
      username: "synthetic",
      role: mocks.role,
      mustChangePassword: false,
      isActive: true,
    },
  }),
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api: mocks.api,
}));

const summary = {
  totalReports: 3,
  headNurseReports: 2,
  pharmacistReports: 1,
  reportsToday: 0,
  reportsThisMonth: 3,
  activeStaffAccounts: 4,
  totalCategorySelections: 4,
  totalChecks: 10,
  compliantChecks: 7,
  nonCompliantChecks: 3,
  complianceRate: 70,
  nonComplianceRate: 30,
  timezoneOffset: "+05:00",
  asOf: "2026-10-30T00:00:00.000Z",
};
const trends = {
  interval: "daily",
  points: [],
  totals: {
    totalReports: 0,
    totalCategorySelections: 0,
    totalChecks: 0,
    compliantChecks: 0,
    nonCompliantChecks: 0,
  },
  timezoneOffset: "+05:00",
  from: "2026-10-01",
  to: "2026-10-30",
};
beforeEach(() => {
  mocks.api.mockReset();
  mocks.api.mockImplementation(async (url: string) => {
    const path = url.split("?")[0];
    if (path.endsWith("/summary")) return { success: true, data: summary };
    if (path.endsWith("/trends")) return { success: true, data: trends };
    if (path.includes("/dashboard/categories"))
      return {
        success: true,
        data: {
          categories: [],
          totals: { totalReports: 0, totalCategorySelections: 0 },
        },
      };
    return { success: true, data: [] };
  });
});
function mount(scope: "admin" | "self") {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter>
        <Dashboard scope={scope} />
      </MemoryRouter>
    </SWRConfig>,
  );
}
const requested = (needle: string) =>
  mocks.api.mock.calls.some((call) => String(call[0]).includes(needle));

describe("role-based dashboard visibility", () => {
  it("lists only the Super Admin for graphical analytics (one place to reverse)", () => {
    expect([...GRAPHICAL_ANALYTICS_ROLES]).toEqual(["SUPER_ADMIN"]);
    expect(canViewGraphicalAnalytics("SUPER_ADMIN")).toBe(true);
    expect(canViewGraphicalAnalytics("HEAD_NURSE")).toBe(false);
    expect(canViewGraphicalAnalytics("PHARMACIST")).toBe(false);
    expect(canViewGraphicalAnalytics(undefined)).toBe(false);
  });

  it("Head Nurse sees the clinical reporting overview and no graphs", async () => {
    mocks.role = "HEAD_NURSE";
    mount("self");
    expect(await screen.findByText("Clinical compliance overview")).toBeInTheDocument();
    expect(screen.queryByText("Submission trends")).toBeNull();
    expect(screen.queryByText("Check outcomes")).toBeNull();
    expect(screen.queryByText("Pharmacy reporting overview")).toBeNull();
    expect(requested("/trends")).toBe(false);
  });

  it("Pharmacist sees the pharmacy reporting overview and no graphs", async () => {
    mocks.role = "PHARMACIST";
    mount("self");
    expect(await screen.findByText("Pharmacy reporting overview")).toBeInTheDocument();
    expect(screen.getByText("Quick reporting access")).toBeInTheDocument();
    expect(screen.queryByText("Submission trends")).toBeNull();
    expect(screen.queryByText("Check outcomes")).toBeNull();
    expect(screen.queryByText("Clinical compliance overview")).toBeNull();
    expect(requested("/trends")).toBe(false);
  });

  it("Super Admin keeps every graph and the additional analytics", async () => {
    mocks.role = "SUPER_ADMIN";
    mount("admin");
    expect(await screen.findByText("Submission trends")).toBeInTheDocument();
    expect(screen.getByText("Check outcomes")).toBeInTheDocument();
    expect(screen.getByText("Compliance performance")).toBeInTheDocument();
    expect(screen.getByText("Administrative overview")).toBeInTheDocument();
    expect(requested("/trends")).toBe(true);
  });
});

describe("role workspace headings", () => {
  it("uses role-specific headings and checklist designations", () => {
    expect(workspaceLabels.HEAD_NURSE).toEqual({
      heading: "HEAD NURSE WORKSPACE",
      checklist: "Head Nurse Checklist",
    });
    expect(workspaceLabels.PHARMACIST).toEqual({
      heading: "PHARMACIST WORKSPACE",
      checklist: "Clinical Pharmacist Checklist",
    });
  });
});

describe("period helpers", () => {
  it("computes the previous period of equal length", () => {
    expect(previousPeriod({ from: "2026-10-08", to: "2026-10-14" })).toEqual({
      from: "2026-10-01",
      to: "2026-10-07",
      days: 7,
    });
    expect(previousPeriod({ from: "2026-10-10", to: "2026-10-10" })).toEqual({
      from: "2026-10-09",
      to: "2026-10-09",
      days: 1,
    });
  });
  it("offers no comparison without a complete, valid range", () => {
    expect(previousPeriod({})).toBeUndefined();
    expect(previousPeriod({ from: "2026-10-08" })).toBeUndefined();
    expect(previousPeriod({ from: "2026-10-14", to: "2026-10-08" })).toBeUndefined();
  });
  it("describes the selected period and changes", () => {
    expect(describePeriod({})).toBe("All recorded activity");
    expect(describePeriod({ from: "2026-10-08", to: "2026-10-14" })).toBe("08-Oct-2026 to 14-Oct-2026");
    expect(change(12, 10)).toMatchObject({ diff: 2, label: "+2" });
    expect(change(12, 10).percent).toBeCloseTo(20);
    expect(change(5, 0).percent).toBeUndefined();
    expect(change(4, 4).label).toBe("No change");
  });
});
