import { useId } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import {
  useTheme,
  type ThemePreference,
  type ResolvedTheme,
} from "../lib/theme";

const OPTIONS: {
  value: ThemePreference;
  title: string;
  description: string;
  icon: typeof Sun;
}[] = [
  {
    value: "light",
    title: "Light Mode",
    description: "Bright, clean surfaces. Ideal for well-lit wards and offices.",
    icon: Sun,
  },
  {
    value: "dark",
    title: "Dark Mode",
    description: "Soft charcoal surfaces that are easier on the eyes at night.",
    icon: Moon,
  },
  {
    value: "system",
    title: "System Default",
    description: "Automatically follows your device's appearance setting.",
    icon: Monitor,
  },
];

/** Miniature, theme-independent preview of the application in one appearance. */
function Preview({ mode }: { mode: ResolvedTheme }) {
  return (
    <span className={`theme-mini ${mode}`} aria-hidden="true">
      <span className="theme-mini-side">
        <i />
        <i />
        <i />
      </span>
      <span className="theme-mini-main">
        <span className="theme-mini-top" />
        <span className="theme-mini-cards">
          <b />
          <b />
        </span>
        <span className="theme-mini-bar" />
        <span className="theme-mini-bar short" />
      </span>
    </span>
  );
}

export default function AppearanceSettings() {
  const { preference, resolved, setPreference } = useTheme();
  const name = useId();
  return (
    <section className="panel form-panel appearance" aria-labelledby="appearance-title">
      <div>
        <h2 id="appearance-title">Appearance &amp; Personalization</h2>
        <p className="hint">
          Choose how the portal looks on this device. Your choice is saved for
          your account only and applies immediately.
        </p>
      </div>
      <div className="theme-options" role="radiogroup" aria-labelledby="appearance-title">
        {OPTIONS.map(({ value, title, description, icon: Icon }) => {
          const selected = preference === value;
          return (
            <label
              key={value}
              className={`theme-option ${selected ? "selected" : ""}`}
            >
              <input
                type="radio"
                name={name}
                value={value}
                checked={selected}
                onChange={() => setPreference(value)}
              />
              <span className="theme-preview">
                {value === "system" ? (
                  <span className="theme-mini-split">
                    <Preview mode="light" />
                    <Preview mode="dark" />
                  </span>
                ) : (
                  <Preview mode={value} />
                )}
              </span>
              <span className="theme-option-text">
                <strong>
                  <Icon size={15} aria-hidden="true" />
                  {title}
                </strong>
                <small>{description}</small>
              </span>
              <span className="theme-check" aria-hidden="true">
                {selected && <Check size={14} strokeWidth={3} />}
              </span>
            </label>
          );
        })}
      </div>
      <p className="hint" role="status">
        Currently showing the {resolved} appearance
        {preference === "system" ? " (from your device setting)" : ""}.
      </p>
    </section>
  );
}
