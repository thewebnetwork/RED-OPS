# RED OPS — Project Context for Claude Code

> Multi-tenant agency operations platform for **Red Ribbon Group (RRG)**
> Live at: `redops.redribbongroup.ca` — deployed via Railway from `main` branch

---

## Tech Stack

- **Backend**: FastAPI + MongoDB (Motor async driver) — Python 3.11
- **Frontend**: React 18 + CSS variables dark design system
- **Build**: `npx craco build` (NOT react-scripts) — craco handles `@/` path aliasing
- **Deploy**: `git push origin main` → Railway auto-deploys from GitHub
- **Auth**: JWT tokens — `get_current_user` returns full user dict
- **Admin creds (dev)**: `redops@redribbongroup.ca` / `Fmtvvl171**`

---

## Architecture Rules

### Backend Patterns

```python
# Imports — always absolute
from database import db
from utils.auth import get_current_user, require_roles

# Auth dependency
current_user: dict = Depends(get_current_user)

# Role checking via require_roles — returns async dependency, takes 1 arg (list)
# CORRECT:
_admin = Depends(require_roles(["Administrator"]))
# WRONG (will TypeError):
# require_roles(current_user, ["Administrator"])

# Inline role check alternative:
if current_user.get("role") not in ["Administrator", "Admin"]:
    raise HTTPException(status_code=403, detail="Admin access required")

# User ID — UUID string
user_id = current_user["id"]

# Org ID resolution — 3-level fallback (ALWAYS use this pattern)
org_id = user.get("org_id") or user.get("team_id") or user.get("id")

# Role alias system in utils/auth.py
# ROLE_ALIASES maps "Admin" → "Administrator", "Editor" → "Operator", etc.
# require_roles checks both direct match AND alias mapping
# So using ["Admin"] in endpoints actually works for "Administrator" users

# All DB operations MUST be awaited (Motor is async)
result = await db.collection.find_one({"_id": id})
# NOT: result = db.collection.find_one({"_id": id})
```

### Frontend Patterns

```javascript
// API base
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const tok = () => localStorage.getItem('token');

// Fetch pattern
const res = await fetch(`${API}/endpoint`, {
  headers: { Authorization: `Bearer ${tok()}` }
});

// Role detection
const isClient = user?.role === 'Media Client' || user?.account_type === 'Media Client';
const isAdmin = user?.role === 'Administrator' || user?.role === 'Admin';

// Preview-as-client mode (admin viewing platform as a specific client)
const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
const previewClientName = isPreview ? localStorage.getItem('preview_client_name') : null;

// In preview mode, scope API calls to the preview client:
const url = isPreview && previewClientId
  ? `${API}/orders?requester_id=${previewClientId}`
  : `${API}/orders/my-requests`;
```

### CSS Design System (Dark Theme)

```css
/* Backgrounds */
--bg: #0d0d0d;          /* page background */
--bg-card: #161616;      /* cards, sidebar */
--bg-elevated: #1e1e1e;  /* hover, inputs */
--bg-overlay: #252525;   /* deep elevated */

/* Borders */
--border: #2a2a2a;
--border-hi: #3a3a3a;

/* Text */
--tx-1: #f0f0f0;  /* primary */
--tx-2: #a0a0a0;  /* secondary */
--tx-3: #606060;  /* muted */

/* Brand & Status */
--red: #c92a3e;           /* RRG brand red */
--green: #22c55e;
--yellow: #f59e0b;
--blue: #3b82f6;
--purple: #a855f7;
--red-status: #ef4444;
```

### CSS Utility Classes Available

- `.responsive-grid-4` / `.responsive-grid-3` / `.responsive-grid-2` — auto-collapse grids (4→2→1)
- `.metrics-grid-4` / `.metrics-grid-3` / `.metrics-grid` — metric card grids with breakpoints
- `.hide-mobile` — hidden below 768px
- `.hide-desktop` — hidden above 768px
- `.mobile-scroll-x` — horizontal scroll wrapper for tables/kanban on mobile
- `.page-content` — standard page padding (24px desktop, 12px mobile)
- `.card` / `.metric-card` / `.hover-card` — card surfaces
- `.pill-green` / `.pill-red` / `.pill-yellow` / `.pill-blue` / `.pill-purple` / `.pill-gray` — status badges
- `.btn-primary` / `.btn-ghost` / `.btn-sm` / `.btn-xs` — buttons
- `.data-table` — styled table
- `.kanban-col` / `.kanban-card` — kanban board
- `.modal-overlay` / `.modal-box` — modals (full-width bottom sheet on mobile)
- `.two-col` / `.col-main` / `.col-side` — two-column layout (stacks on mobile <900px)

---

## Routing & Navigation

### Home Route Architecture

The `/` route does NOT use `Dashboard.js`. It uses `HomeRoute` in `App.js`:

```javascript
function HomeRoute() {
  const { user } = useAuth();
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const isClient = isPreview || user?.account_type === 'Media Client' || user?.role === 'Media Client';
  if (isClient) return <ClientHome />;
  return <CommandCenter />;
}
```

- Admin → `CommandCenter.js` (agency dashboard with KPIs, quick actions, activity feed)
- Client → `ClientHome.js` (client portal with orders, projects summary)

### Auth Roles

| Role | Access Level |
|------|-------------|
| Administrator | Full access, all admin views |
| Operator | Most admin views, no settings |
| Standard User | Internal team, limited views |
| Media Client | Client portal only |

### Client-Allowed Routes (in App.js)

```javascript
const CLIENT_ALLOWED = [
  '/', '/tasks', '/projects', '/services', '/my-requests',
  '/my-account', '/files', '/notifications', '/ad-performance'
];
```

### Sidebar Nav (in Layout.js)

- **NAV_MAIN** (admin): Home, Tasks, Projects, Requests, Services
- **NAV_BUSINESS** (admin): Clients, Team, Reports, Ad Performance
- **NAV_SYSTEM** (admin): AI Assistant, Files & Docs, Settings
- **NAV_CLIENT** (client/preview): Dashboard, My Tasks, My Projects, My Requests, Services, Ad Performance, Resources, My Account

Preview-as-client mode: Layout.js checks `localStorage.getItem('preview_as_client')` and shows client nav instead of admin nav.

---

## Backend Route Modules (35 files)

`backend/routes/`: access_tiers, ad_performance, ambassador, api_keys, auth, categories, crm, dashboard, dashboard_builder, dashboard_v2, documentation, escalation, feedback, files, iam, knowledge_base, notifications, orders, organizations, projects, ratings, reports, roles, service_templates, settings, sla, sla_policies, specialties, subscription_plans, tasks, teams, users, webhooks, workflows

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `frontend/src/App.js` | Core routing, HomeRoute dispatcher, CLIENT_ALLOWED list |
| `frontend/src/components/Layout.js` | Sidebar nav, top bar, AccountSwitcher, preview mode |
| `frontend/src/pages/CommandCenter.js` | Admin home — KPIs, quick actions, activity |
| `frontend/src/pages/ClientHome.js` | Client home — orders, projects summary |
| `frontend/src/pages/AdPerformance.js` | Hyros Lite — client & admin ad dashboards (~1300 lines) |
| `frontend/src/pages/Tasks.js` | Kanban task board |
| `frontend/src/pages/Projects.js` | Projects hub (admin) / client projects view |
| `frontend/src/pages/MyRequests.js` | Client request list |
| `frontend/src/index.css` | Full design system — CSS variables, components, responsive utilities |
| `frontend/src/App.css` | Tailwind/shadcn dark theme overrides |
| `backend/routes/ad_performance.py` | Hyros Lite API — CRUD snapshots, client summary, agency overview |
| `backend/routes/ambassador.py` | Ambassador/referral system |
| `backend/utils/auth.py` | JWT auth, get_current_user, require_roles, ROLE_ALIASES |
| `backend/database.py` | MongoDB connection via Motor |

---

## Order Status Flow

`Open → In Progress → Pending → Delivered → Closed` (or `Canceled` at any point)

---

## Preview-as-Client Mode

Admins can preview the platform as any client via the AccountSwitcher in the sidebar. This sets 3 localStorage keys:

- `preview_as_client` = `"true"`
- `preview_client_id` = client's user ID
- `preview_client_name` = client's display name

Every page that shows client-scoped data must check for preview mode and pass the preview client's ID as a query parameter instead of relying on the JWT (which is still the admin's token).

Pages already updated for preview mode: HomeRoute (App.js), Layout.js, ClientHome.js, MyRequests.js, Tasks.js, Projects.js, AdPerformance.js.

---

## Recent Fixes (This Session)

1. **ambassador.py** — Added proper auth (Depends) to all 17 endpoints, added await to all 33 DB calls, fixed async function
2. **ad_performance.py** — Fixed require_roles TypeError, returns empty summary instead of 404 for no-data clients
3. **Preview mode** — Fixed across 6 files so admin preview actually shows client views with client-scoped data
4. **Field mismatches** — Fixed `monthly_trend`→`monthly_trends`, `t.month`→`t.period`, date format `YYYY-MM-DD`→`YYYY-MM` in AdPerformance
5. **org_id resolution** — Added 3rd-level fallback (`or user.get("id")`) in crm.py, knowledge_base.py, ambassador.py

---

## Pending Work

### Mobile Responsive (In Progress)
CSS foundation is done (breakpoints for sidebar, grids, modals, tables, page padding).
- [x] Layout.js top bar — hide search kbd shortcut on mobile, compact "New Request" button
- [x] CommandCenter.js — replace inline grid styles with responsive CSS classes
- [x] ClientHome.js — replace inline grid styles with responsive CSS classes
- [x] AdPerformance.js — replace inline grid styles with responsive CSS classes
- [ ] Test across all key pages at 375px width

### Future Features (Not Started)
- Notification preferences in settings
- File upload progress indicator
- Dashboard builder custom widgets
- Client invoice/billing integration
- Team capacity heatmap
