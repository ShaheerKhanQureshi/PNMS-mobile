import { useState } from "react";
import { useAuth } from "./session";
import { Field } from "../components/ui";
import { roleLabels } from "../lib/types";
import { ChangePasswordForm } from "./password";
/**
 * Account Settings. Name, username and role are display-only for everyone: the API only lets a Super Admin change
 * them (through Staff accounts); this page can only change the signed-in user's own password.
 */
export default function Account() {
  const { user } = useAuth();
  const [changed, setChanged] = useState(false);
  if (!user) return null;
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow muted">ACCOUNT SETTINGS</div>
          <h1>Your account</h1>
          <p>Review your profile and keep your password secure.</p>
        </div>
      </div>
      <section className="panel form-panel">
        <h2>Profile</h2>
        <div className="profile-fields">
          <Field label="Full name" name="accountFullName" value={user.fullName} readOnly />
          <Field label="Username" name="accountUsername" value={user.username} readOnly />
          <Field label="Role" name="accountRole" value={roleLabels[user.role]} readOnly />
        </div>
        <p className="hint">
          {user.role === "SUPER_ADMIN"
            ? "As a Super Administrator you manage account details from Staff accounts."
            : "Your name, username and role can only be changed by a Super Administrator."}
        </p>
      </section>
      {changed && (
        <div className="notice success" role="status">
          Your password was updated successfully.
          <button className="text-button" onClick={() => setChanged(false)}>
            Dismiss
          </button>
        </div>
      )}
      <ChangePasswordForm
        heading="Change password"
        onChanged={() => setChanged(true)}
      />
    </div>
  );
}
