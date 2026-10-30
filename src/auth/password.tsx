import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { mutateApi } from "../lib/api";
import { changePasswordSchema, PASSWORD_POLICY_HINT } from "../lib/validation";
import { ErrorNotice, PasswordField } from "../components/ui";
import { useAuth } from "./session";
/**
 * Change-password form, shared by the "Account security" page (/password, also used for the forced first-login
 * change) and the Account Settings page. Without `onChanged` it returns to the home page after success.
 */
export function ChangePasswordForm({
  heading,
  onChanged,
}: {
  heading?: string;
  onChanged?: () => void;
}) {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<{
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }>({ resolver: zodResolver(changePasswordSchema) });
  return (
    <form
      className="panel form-panel"
      onSubmit={handleSubmit(async ({ currentPassword, newPassword }) => {
        setError(undefined);
        try {
          await mutateApi("/api/auth/change-password", "POST", {
            currentPassword,
            newPassword,
          });
          reset();
          await refresh();
          if (onChanged) onChanged();
          else navigate("/", { replace: true });
        } catch (e) {
          setError(e);
        }
      })}
    >
      <KeyRound size={25} />
      {heading && <h2>{heading}</h2>}
      <ErrorNotice error={error} />
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        {...register("currentPassword")}
        error={errors.currentPassword?.message}
      />
      <PasswordField
        label="New password"
        autoComplete="new-password"
        {...register("newPassword")}
        error={errors.newPassword?.message}
      />
      <p className="hint">
        {PASSWORD_POLICY_HINT} Do not use your username or a common password.
      </p>
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        {...register("confirmPassword")}
        error={errors.confirmPassword?.message}
      />
      <button className="button" disabled={isSubmitting}>
        {isSubmitting ? "Updating password…" : "Update password"}
      </button>
    </form>
  );
}
export default function Password() {
  const { user } = useAuth();
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">ACCOUNT SECURITY</div>
          <h1>
            {user?.mustChangePassword
              ? "Set your own password"
              : "Change password"}
          </h1>
          <p>
            {user?.mustChangePassword
              ? "Before continuing, replace the temporary password supplied by your administrator."
              : "Keep your staff account secure with a strong, unique password."}
          </p>
        </div>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
