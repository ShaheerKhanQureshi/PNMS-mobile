import { useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, mutateApi } from "../lib/api";
import type { User, Envelope, Role } from "../lib/types";
import { roleLabels } from "../lib/types";
import {
  passwordSchema,
  PASSWORD_POLICY_HINT,
  PASSWORD_POLICY_MESSAGE,
} from "../lib/validation";
import { useAuth } from "../auth/session";
import { Field, PasswordField, ErrorNotice, Loading } from "../components/ui";
const schema = z.object({
  fullName: z.string().trim().min(1, "Enter the staff member’s name.").max(120),
  username: z
    .string()
    .trim()
    .min(3)
    .max(50)
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Use letters, numbers, dots, underscores, or hyphens.",
    ),
  role: z.enum(["HEAD_NURSE", "PHARMACIST", "SUPER_ADMIN"]),
  password: z.union([z.literal(""), passwordSchema]),
});
function AccountForm({
  existing,
  onSaved,
}: {
  existing?: User;
  onSaved: (user: User & { temporaryPassword?: string }) => void;
}) {
  const { user } = useAuth();
  const [error, setError] = useState<unknown>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: existing?.fullName || "",
      username: existing?.username || "",
      role: existing?.role || "HEAD_NURSE",
      password: "",
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={handleSubmit(async (values) => {
        setError(undefined);
        try {
          const body = existing
            ? {
                fullName: values.fullName,
                ...(existing.id !== user?.id ? { role: values.role } : {}),
              }
            : {
                fullName: values.fullName,
                username: values.username,
                role: values.role,
                ...(values.password ? { password: values.password } : {}),
              };
          const result = await mutateApi<User & { temporaryPassword?: string }>(
            existing ? `/api/users/${existing.id}` : "/api/users",
            existing ? "PATCH" : "POST",
            body,
          );
          onSaved(result.data);
        } catch (e) {
          setError(e);
        }
      })}
    >
      <ErrorNotice error={error} />
      <Field
        label="Full name"
        {...register("fullName")}
        error={errors.fullName?.message}
      />
      <Field
        label="Username"
        {...register("username")}
        readOnly={!!existing}
        autoCapitalize="none"
        autoComplete="off"
        error={errors.username?.message}
      />
      <label className="field">
        Assigned role
        <select {...register("role")} disabled={existing?.id === user?.id}>
          {Object.entries(roleLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {!existing && (
        <>
          <PasswordField
            label="Initial password (optional)"
            {...register("password")}
            autoComplete="new-password"
            error={errors.password?.message}
          />
          <p className="hint">
            Leave blank to securely generate a temporary password. Staff must
            change their password at first sign-in. A password you set must
            have {PASSWORD_POLICY_HINT}
          </p>
        </>
      )}
      {existing && (
        <p className="hint">
          Changing a role revokes this staff member&apos;s current sessions. The
          last active administrator cannot be demoted.
        </p>
      )}
      <button className="button" disabled={isSubmitting}>
        {isSubmitting
          ? "Saving…"
          : existing
            ? "Save account changes"
            : "Create staff account"}
      </button>
    </form>
  );
}
export function StaffEditor({
  id,
  onSaved,
}: {
  id?: number;
  onSaved: (user: User & { temporaryPassword?: string }) => void;
}) {
  const record = useSWR<Envelope<User>>(id ? `/api/users/${id}` : null, api);
  if (id && record.isLoading) return <Loading />;
  if (record.error)
    return (
      <ErrorNotice error={record.error} retry={() => void record.mutate()} />
    );
  if (id && !record.data) return null;
  return <AccountForm existing={record.data?.data} onSaved={onSaved} />;
}
export function StaffAction({
  target,
  action,
  onSaved,
}: {
  target: User;
  action: "status" | "reset";
  onSaved: (user: User & { temporaryPassword?: string }) => void;
}) {
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        if (
          action === "reset" &&
          password &&
          !passwordSchema.safeParse(password).success
        ) {
          setError(new Error(PASSWORD_POLICY_MESSAGE));
          return;
        }
        setBusy(true);
        setError(undefined);
        try {
          const r = await mutateApi<User & { temporaryPassword?: string }>(
            `/api/users/${target.id}/${action === "status" ? "status" : "reset-password"}`,
            action === "status" ? "PATCH" : "POST",
            action === "status"
              ? { isActive: !target.isActive }
              : password
                ? { password }
                : {},
          );
          setPassword("");
          onSaved(r.data);
        } catch (err) {
          setError(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        {action === "reset"
          ? `Reset the password for ${target.fullName}? This signs them out of all sessions and requires a password change at their next sign-in.`
          : `${target.isActive ? "Deactivate" : "Activate"} ${target.fullName}’s account? ${target.isActive ? "Their current sessions will be revoked immediately." : "They will be able to sign in again."}`}
      </p>
      {action === "reset" && (
        <>
          <PasswordField
            name="resetPassword"
            label="New temporary password (optional)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <p className="hint">
            Leave blank to generate a temporary password. A password you set
            must have {PASSWORD_POLICY_HINT}
          </p>
        </>
      )}
      <ErrorNotice error={error} />
      <button
        className={`button ${action === "status" && target.isActive ? "danger" : ""}`}
        disabled={busy}
      >
        {busy
          ? "Updating…"
          : action === "reset"
            ? "Confirm password reset"
            : target.isActive
              ? "Deactivate account"
              : "Activate account"}
      </button>
    </form>
  );
}
export const staffRoles: Role[] = ["HEAD_NURSE", "PHARMACIST", "SUPER_ADMIN"];
