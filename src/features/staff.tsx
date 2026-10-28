import { useState } from "react";
import useSWR from "swr";
import { UserPlus, Pencil, KeyRound, Power } from "lucide-react";
import { api, queryString } from "../lib/api";
import type { Envelope, User, Filters } from "../lib/types";
import { roleLabels } from "../lib/types";
import { useAuth } from "../auth/session";
import {
  Empty,
  ErrorNotice,
  Field,
  Loading,
  Modal,
  Pagination,
} from "../components/ui";
import { StaffEditor, StaffAction } from "./staff-editor";
export default function Staff() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [draft, setDraft] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dialog, setDialog] = useState<{
    mode: "create" | "edit" | "reset" | "status";
    target?: User;
  }>();
  const [temporary, setTemporary] = useState<string>();
  const [notice, setNotice] = useState("");
  const users = useSWR<Envelope<User[]>>(
    `/api/users${queryString({ ...filters, page: String(page), limit: String(limit) })}`,
    api,
  );
  function saved(result: User & { temporaryPassword?: string }) {
    setDialog(undefined);
    setTemporary(result.temporaryPassword);
    setNotice("Staff account updated successfully.");
    void users.mutate();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">ACCESS MANAGEMENT</div>
          <h1>Staff accounts</h1>
          <p>The right access for every member of your care team.</p>
        </div>
        <button
          className="button"
          onClick={() => setDialog({ mode: "create" })}
        >
          <UserPlus size={18} />
          Add staff member
        </button>
      </div>
      {notice && (
        <div className="notice success" role="status">
          {notice}
          <button className="text-button" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </div>
      )}
      <form
        className="panel filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
          setPage(1);
        }}
      >
        <div className="filter-grid">
          <Field
            label="Search staff"
            name="q"
            placeholder="Name or username"
            value={draft.q || ""}
            maxLength={100}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
          <label className="field">
            Role
            <select
              value={draft.role || ""}
              onChange={(e) => setDraft({ ...draft, role: e.target.value })}
            >
              <option value="">All roles</option>
              {Object.entries(roleLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select
              value={draft.isActive || ""}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.value })}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <label className="field">
            Sort by
            <select
              value={draft.sortBy || "createdAt"}
              onChange={(e) => setDraft({ ...draft, sortBy: e.target.value })}
            >
              {Object.entries({
                createdAt: "Created date",
                fullName: "Full name",
                username: "Username",
                role: "Role",
                lastLoginAt: "Last login",
              }).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Direction
            <select
              value={draft.sortOrder || "desc"}
              onChange={(e) =>
                setDraft({ ...draft, sortOrder: e.target.value })
              }
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
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
      </form>
      <section className="panel">
        <div className="panel-heading">
          <h2>Team directory</h2>
          <span className="hint">
            Accounts are managed by authorized administrators
          </span>
        </div>
        {users.isLoading ? (
          <Loading />
        ) : users.error ? (
          <ErrorNotice error={users.error} retry={() => void users.mutate()} />
        ) : !users.data?.data.length ? (
          <Empty title="No staff accounts found" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Username / ID</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.data.data.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Staff member">
                      <strong>{u.fullName}</strong>
                      {u.id === user?.id && (
                        <span className="cell-secondary">Your account</span>
                      )}
                    </td>
                    <td data-label="Username / ID">
                      {u.username}
                      <span className="cell-secondary">#{u.id}</span>
                    </td>
                    <td data-label="Role">{roleLabels[u.role]}</td>
                    <td data-label="Status">
                      <span
                        className={`pill ${u.isActive ? "active-pill" : ""}`}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="icon-button"
                          title="View and edit account"
                          aria-label={`Edit ${u.fullName}`}
                          onClick={() => setDialog({ mode: "edit", target: u })}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title="Reset password"
                          aria-label={`Reset password for ${u.fullName}`}
                          disabled={u.id === user?.id}
                          onClick={() =>
                            setDialog({ mode: "reset", target: u })
                          }
                        >
                          <KeyRound size={17} />
                        </button>
                        <button
                          className="icon-button"
                          title={u.isActive ? "Deactivate" : "Activate"}
                          aria-label={`${u.isActive ? "Deactivate" : "Activate"} ${u.fullName}`}
                          disabled={u.id === user?.id}
                          onClick={() =>
                            setDialog({ mode: "status", target: u })
                          }
                        >
                          <Power size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          meta={users.data?.meta}
          page={page}
          setPage={setPage}
          limit={limit}
          setLimit={(v) => {
            setLimit(v);
            setPage(1);
          }}
        />
      </section>
      {dialog && (
        <Modal
          title={
            {
              create: "Add staff member",
              edit: "Staff account details",
              reset: "Reset staff password",
              status: "Change account access",
            }[dialog.mode]
          }
          onClose={() => setDialog(undefined)}
        >
          {dialog.mode === "create" || dialog.mode === "edit" ? (
            <StaffEditor id={dialog.target?.id} onSaved={saved} />
          ) : (
            dialog.target && (
              <StaffAction
                target={dialog.target}
                action={dialog.mode}
                onSaved={saved}
              />
            )
          )}
        </Modal>
      )}
      {temporary && (
        <Modal
          title="Temporary password created"
          onClose={() => setTemporary(undefined)}
        >
          <div className="form-stack">
            <p>
              Share this password privately with the staff member. It is
              displayed once and is not saved in the browser.
            </p>
            <code className="temporary-password">{temporary}</code>
            <p className="hint">They must change it at their next sign-in.</p>
            <button className="button" onClick={() => setTemporary(undefined)}>
              I have securely recorded it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
