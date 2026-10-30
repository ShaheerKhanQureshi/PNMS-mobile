import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  LockKeyhole,
  ScanLine,
  ClipboardCheck,
  ChartNoAxesCombined,
  ShieldCheck,
} from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./session";
import { Brand, ErrorNotice, Field, PasswordField } from "../components/ui";
import { loginSchema } from "../lib/validation";

export default function Login() {
  const auth = useAuth();
  const [error, setError] = useState<unknown>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ username: string; password: string }>({
    resolver: zodResolver(loginSchema),
  });
  if (auth.user) return <Navigate to="/" replace />;
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand light />
        <div className="story-content">
          <div className="eyebrow">
            <span className="status-dot" /> CLINICAL OPERATIONS PORTAL
          </div>
          <h1>
            Better observations.
            <br />
            <span>Better care.</span>
          </h1>
          <p>
            A shared commitment to safer care.
            <br />
            Record observations, support your team, and make every patient
            interaction count.
          </p>
          <div className="story-steps">
            {[
              {
                icon: ScanLine,
                title: "Identify with confidence",
                text: "Scan the hospital QR code and verify the MR Number.",
              },
              {
                icon: ClipboardCheck,
                title: "Capture what matters",
                text: "Record observations using approved categories.",
              },
              {
                icon: ChartNoAxesCombined,
                title: "See the bigger picture",
                text: "Turn authorized reports into meaningful oversight.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div className="story-step" key={title}>
                <span>
                  <Icon size={21} strokeWidth={1.5} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="story-footer">
          <ShieldCheck size={17} />
          <span>Purpose-built for authorized healthcare teams</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-top">
          <span>Patient Non-Compliance Monitoring System</span>
          <span className="pill">
            <LockKeyhole size={12} /> Staff access
          </span>
        </div>
        <div className="login-form-wrap">
          <span className="login-lock">
            <LockKeyhole size={25} strokeWidth={1.6} />
          </span>
          <div className="eyebrow muted">WELCOME TO YOUR WORKSPACE</div>
          <h2>Care starts with you.</h2>
          <p className="login-subtitle">
            Sign in to securely access your staff portal.
          </p>
          <form
            onSubmit={handleSubmit(async (values) => {
              setError(undefined);
              try {
                await auth.login(values.username, values.password);
              } catch (e) {
                setError(e);
              }
            })}
            noValidate
          >
            <ErrorNotice error={error || auth.error} />
            <Field
              label="Staff username"
              placeholder="Enter your username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              {...register("username")}
              error={errors.username?.message}
            />
            <PasswordField
              placeholder="Enter your password"
              autoComplete="current-password"
              {...register("password")}
              error={errors.password?.message}
            />
            <div className="login-assistance">
              <LockKeyhole size={14} />
              <span>Use the credentials provided by your administrator.</span>
            </div>
            <button
              className="button login-submit"
              type="submit"
              disabled={isSubmitting || auth.loading}
            >
              {isSubmitting
                ? "Signing in securely…"
                : "Sign in to your workspace"}
              <ArrowRight size={18} />
            </button>
          </form>
          <div className="access-help">
            <h3>Need help accessing your account?</h3>
            <p>
              Contact your hospital administrator for account access or a
              password reset.
            </p>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={16} />
            <p>
              Authorized personnel only. Access and activity are recorded for
              security and accountability.
            </p>
          </div>
        </div>
        <footer className="login-bottom">
          <span>© {new Date().getFullYear()} ChildLife Foundation</span>
          <span>Confidential staff workspace</span>
        </footer>
      </section>
    </main>
  );
}
