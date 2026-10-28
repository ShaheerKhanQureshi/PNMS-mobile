import { useState } from "react";
import useSWR from "swr";
import { Filter, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import type { Category, Envelope, Filters, User } from "../lib/types";
import { Field, ErrorNotice } from "./ui";
export default function ReportFilters({
  value,
  onApply,
  admin,
  checkType = true,
}: {
  value: Filters;
  onApply: (filters: Filters) => void;
  admin: boolean;
  /** Show the Compliance / Non-Compliance / All checks filter (the dashboard analytics always show both). */
  checkType?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<unknown>();
  const categories = useSWR<Envelope<Category[]>>(
    "/api/categories?activeOnly=false",
    api,
  );
  // Staff picker (Super Admin only): filters by the unique staff id, never by display name.
  const nurses = useSWR<Envelope<User[]>>(
    admin ? "/api/users?role=HEAD_NURSE&limit=100&sortBy=fullName&sortOrder=asc" : null,
    api,
  );
  const pharmacists = useSWR<Envelope<User[]>>(
    admin
      ? "/api/users?role=PHARMACIST&limit=100&sortBy=fullName&sortOrder=asc"
      : null,
    api,
  );
  const staff = [
    ...(draft.role === "PHARMACIST" ? [] : (nurses.data?.data ?? [])),
    ...(draft.role === "HEAD_NURSE" ? [] : (pharmacists.data?.data ?? [])),
  ].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const update = (key: string, v: string) => setDraft({ ...draft, [key]: v });
  return (
    <form
      className="panel filters"
      onSubmit={(e) => {
        e.preventDefault();
        if (draft.from && draft.to && draft.from > draft.to) {
          setError(new Error("Start date must not be after end date."));
          return;
        }
        setError(undefined);
        onApply(draft);
      }}
    >
      <div className="filter-heading">
        <span>
          <Filter size={16} />
          Filter records
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setDraft({});
            onApply({});
            setError(undefined);
          }}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>
      <div className="filter-grid">
        <Field
          label="From date"
          name="from"
          type="date"
          value={draft.from || ""}
          onChange={(e) => update("from", e.target.value)}
        />
        <Field
          label="To date"
          name="to"
          type="date"
          value={draft.to || ""}
          onChange={(e) => update("to", e.target.value)}
        />
        <Field
          label="MR Number (exact)"
          name="mrNumber"
          placeholder="Enter MR Number"
          autoComplete="off"
          value={draft.mrNumber || ""}
          onChange={(e) => update("mrNumber", e.target.value)}
        />
        {admin && (
          <>
            <label className="field">
              Staff role
              <select
                value={draft.role || ""}
                onChange={(e) =>
                  // A different role invalidates the selected staff member (they may belong to the other role).
                  setDraft({ ...draft, role: e.target.value, staffId: "" })
                }
              >
                <option value="">All staff roles</option>
                <option value="HEAD_NURSE">Head Nurse</option>
                <option value="PHARMACIST">Pharmacist</option>
              </select>
            </label>
            <label className="field">
              Staff member
              <select
                value={draft.staffId || ""}
                onChange={(e) => update("staffId", e.target.value)}
                disabled={nurses.isLoading || pharmacists.isLoading}
              >
                <option value="">All staff members</option>
                {staff.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} (@{u.username}
                    {u.isActive ? "" : ", inactive"})
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {checkType && (
          <label className="field">
            Check type
            <select
              value={draft.checkStatus || ""}
              onChange={(e) => update("checkStatus", e.target.value)}
            >
              <option value="">All checks</option>
              <option value="COMPLIANT">Compliance</option>
              <option value="NON_COMPLIANT">Non-Compliance</option>
            </select>
          </label>
        )}
        <label className="field">
          Category
          <select
            value={draft.categoryId || ""}
            onChange={(e) => update("categoryId", e.target.value)}
            disabled={categories.isLoading || !!categories.error}
          >
            <option value="">All categories</option>
            {categories.data?.data
              .filter((c) => !draft.role || c.allowedRole === draft.role)
              .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button className="button secondary" type="submit">
          Apply filters
        </button>
      </div>
      <ErrorNotice
        error={error || categories.error || nurses.error || pharmacists.error}
        retry={
          categories.error
            ? () => void categories.mutate()
            : nurses.error || pharmacists.error
              ? () => {
                  void nurses.mutate();
                  void pharmacists.mutate();
                }
              : undefined
        }
      />
    </form>
  );
}
