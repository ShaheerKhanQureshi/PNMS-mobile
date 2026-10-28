import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import NewReport from "../features/new-report";
import { RoleGate } from "../components/layout";
import { ApiError } from "../lib/api";
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  user: {
    id: 12,
    fullName: "Synthetic Nurse",
    username: "synthetic",
    role: "HEAD_NURSE",
    mustChangePassword: false,
  },
}));
vi.mock("../auth/session", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  api: vi.fn(async () => ({
    success: true,
    data: [
      {
        id: 2,
        name: "Synthetic nursing category",
        allowedRole: "HEAD_NURSE",
        isActive: true,
      },
      {
        id: 6,
        name: "Synthetic pharmacy category",
        allowedRole: "PHARMACIST",
        isActive: true,
      },
    ],
  })),
  mutateApi: mocks.mutate,
}));
vi.mock("../features/scanner", () => ({
  default: ({ onDetected }: { onDetected: (value: string) => void }) => (
    <button onClick={() => onDetected("000012345")}>
      Decode synthetic QR fixture
    </button>
  ),
}));
function mount() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MemoryRouter>
        <NewReport />
      </MemoryRouter>
    </SWRConfig>,
  );
}
beforeEach(() => {
  mocks.mutate.mockReset();
});
describe("clinical reporting contract", () => {
  it("requires explicit confirmation and hides cross-role categories", async () => {
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Decode synthetic QR fixture" }),
    );
    expect(screen.getByText("000012345")).toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and continue" }),
    );
    // Both outcomes are offered; categories appear only for Non-Compliance.
    expect(
      await screen.findByLabelText(/Compliance — No Non-Compliance Found/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Synthetic nursing category")).toBeNull();
    fireEvent.click(screen.getByLabelText(/Non-Compliance — Issue Identified/));
    expect(
      await screen.findByLabelText("Synthetic nursing category"),
    ).toBeInTheDocument();
    expect(screen.getByText("Select Non-Compliance Categories")).toBeInTheDocument();
    expect(screen.queryByLabelText("Synthetic pharmacy category")).toBeNull();
    // At least one category is required for a non-compliance report.
    expect(
      screen.getByRole("button", { name: "Submit non-compliance report" }),
    ).toBeDisabled();
  });
  it("submits a compliant check without any category", async () => {
    mocks.mutate.mockResolvedValueOnce({
      data: {
        id: 22,
        mrNumber: "000012345",
        checkStatus: "COMPLIANT",
        categories: [],
      },
    });
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Decode synthetic QR fixture" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and continue" }),
    );
    expect(
      screen.getByRole("button", { name: "Submit compliant check" }),
    ).toBeDisabled(); // nothing chosen yet
    fireEvent.click(
      await screen.findByLabelText(/Compliance — No Non-Compliance Found/),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit compliant check" }),
    );
    await screen.findByText("The patient check was saved as compliant.");
    expect(mocks.mutate.mock.calls[0][2]).toEqual({
      mrNumber: "000012345",
      checkStatus: "COMPLIANT",
    });
  });
  it("preserves the exact idempotency key and body after an uncertain outcome", async () => {
    mocks.mutate
      .mockRejectedValueOnce(
        new ApiError(0, "NETWORK_ERROR", "Network unavailable"),
      )
      .mockResolvedValueOnce({
        data: {
          id: 21,
          mrNumber: "000012345",
          categories: ["Synthetic nursing category"],
        },
      });
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Decode synthetic QR fixture" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm and continue" }),
    );
    fireEvent.click(
      await screen.findByLabelText(/Non-Compliance — Issue Identified/),
    );
    fireEvent.click(await screen.findByLabelText("Synthetic nursing category"));
    fireEvent.click(
      screen.getByRole("button", { name: "Submit non-compliance report" }),
    );
    await screen.findByRole("button", { name: "Safely retry submission" });
    expect(screen.getByLabelText("Synthetic nursing category")).toBeDisabled();
    expect(
      screen.queryByText("Your report has been saved successfully."),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Safely retry submission" }),
    );
    await screen.findByText("Your report has been saved successfully.");
    expect(mocks.mutate.mock.calls[1]).toEqual(mocks.mutate.mock.calls[0]);
    expect(mocks.mutate.mock.calls[0][2]).toEqual({
      mrNumber: "000012345",
      checkStatus: "NON_COMPLIANT",
      categoryIds: [2],
    });
    fireEvent.click(screen.getByRole("button", { name: "Scan next patient" }));
    await waitFor(() => expect(screen.queryByText("000012345")).toBeNull());
  });
  it("does not render administrator-only content for a nurse", () => {
    render(
      <MemoryRouter initialEntries={["/staff"]}>
        <RoleGate admin>
          <div>Protected staff editor</div>
        </RoleGate>
      </MemoryRouter>,
    );
    expect(screen.queryByText("Protected staff editor")).toBeNull();
  });
});
