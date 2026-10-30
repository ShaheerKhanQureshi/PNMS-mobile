# Theme, role-based dashboards and mobile refinements (frontend only)

## Role-based dashboard visibility
- One switch: `src/features/dashboard-visibility.ts` (`GRAPHICAL_ANALYTICS_ROLES`, currently `["SUPER_ADMIN"]`).
- Graph components live in `src/features/analytics-charts.tsx` (`GraphicalAnalytics`, plus the Super Admin additions
  `CompliancePerformance` and `AdminInsights`). They are not deleted; `dashboard.tsx` renders them only for listed roles.
- Head Nurse / Pharmacist dashboards: `src/features/role-reporting.tsx` (`HeadNurseReporting`, `PharmacistReporting`).
- To restore the graphs for a role, add it to `GRAPHICAL_ANALYTICS_ROLES`. This is presentation only; the API still
  enforces authorisation.
- Roles that do not see the graphs do not request `/trends`.

## Theme
- `src/lib/theme.tsx`: `ThemeProvider`, `useTheme`, `chartPalette`. Preference (`light | dark | system`) is stored in
  `localStorage` under `pnms.theme.v1.user.<user id>`. Also stored: `pnms.theme.hint` (last choice, non-sensitive).
- `public/theme-init.js` (loaded from `index.html`) applies the hinted theme before first paint. It is an external file
  because the Content-Security-Policy forbids inline scripts.
- `src/theme-tokens.css` holds one light and one dark value for every colour used in `styles.css`. Light values are the
  original palette. Edit a dark value there to retune dark mode.
- Account Settings → Appearance & Personalization (`src/components/appearance.tsx`).

## Comparison periods
`src/features/period.ts`: the previous period is only offered when both From and To dates are selected.
