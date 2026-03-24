# RED OPS — Full Session Handoff

> This document captures EVERYTHING done in the Cowork session so Claude Code can continue seamlessly.
> Read this alongside `CLAUDE.md` (architecture reference) for full context.

---

## Session Overview

**Goal**: Build Red Ops into a multi-tenant agency operations platform for RRG (Red Ribbon Group)
**Deployed at**: `redops.redribbongroup.ca` via Railway (auto-deploys from `main`)
**Admin creds**: `redops@redribbongroup.ca` / `Fmtvvl171**`

---

## Phase 1: Hyros Lite (Ad Performance Dashboard) — COMPLETE

### What Was Built

A full ad performance tracking module ("Hyros Lite") with both client and admin views.

### Backend: `backend/routes/ad_performance.py` (~549 lines)

7 endpoints:
- `POST /api/ad-performance/snapshots` — Create snapshot (admin only)
- `GET /api/ad-performance/snapshots` — List snapshots with filters
- `GET /api/ad-performance/snapshots/{id}` — Get single snapshot
- `PUT /api/ad-performance/snapshots/{id}` — Update snapshot
- `DELETE /api/ad-performance/snapshots/{id}` — Delete snapshot
- `GET /api/ad-performance/clients/{client_id}/summary` — Client summary with KPIs, trends, platforms
- `GET /api/ad-performance/agency/overview` — Agency-wide overview with per-client metrics

**Pydantic models**: `AdSnapshot`, `AdSnapshotCreate`, `AdSnapshotUpdate`, `ClientSummary`, `ClientSummaryPeriod`, `PlatformSummary`, `AgencyOverview`

**Key design decisions**:
- Summary endpoint returns empty `ClientSummary` (NOT 404) when client has no snapshots
- `PlatformSummary` model added for per-platform breakdown (Meta, Google, TikTok, etc.)
- `month` alias added to `ClientSummaryPeriod` for frontend compatibility
- Admin endpoints use inline role checks instead of `require_roles` dependency (avoids TypeError)
- Period format is `YYYY-MM` (not `YYYY-MM-DD`)

### Frontend: `frontend/src/pages/AdPerformance.js` (~1,300 lines)

Two dashboard components:

**`ClientAdDashboard`**:
- 4-card KPI row (Total Spend, Total Leads, Avg CPL, Avg ROAS)
- 6-month trend chart (Recharts AreaChart)
- Platform breakdown cards
- Snapshots history table
- Supports preview-as-client mode (uses `preview_client_id`)

**`AdminAdDashboard`**:
- 5-card agency KPI row (Total Clients, Total Spend, Total Leads, Avg CPL, Avg ROAS)
- Client performance table with expandable rows showing monthly breakdown
- "Add Snapshot" modal with full form (client, platform, period, metrics)
- Independent try/catch for agency overview vs client list (one failing doesn't crash the other)

**Router component `AdPerformancePage`**:
- Checks role + preview mode
- Routes to `ClientAdDashboard` or `AdminAdDashboard`

### Routing & Nav Integration

**`App.js`**:
- Added `import AdPerformance from "./pages/AdPerformance"`
- Added `/ad-performance` to `CLIENT_ALLOWED` array
- Added `<Route path="/ad-performance" element={<PrivateRoute><AdPerformance /></PrivateRoute>} />`

**`Layout.js`**:
- Added to `NAV_BUSINESS`: `{ path: '/ad-performance', icon: BarChart2, label: 'Ad Performance', roles: ['Administrator','Operator'] }`
- Added to `NAV_CLIENT`: `{ path: '/ad-performance', icon: BarChart2, label: 'Ad Performance', roles: ['Media Client'] }`
- `BarChart2` icon was already imported

---

## Phase 2: Full-Stack Audit — COMPLETE

Ran 3 parallel audit agents across the entire codebase. Found and fixed critical issues.

### Fix 1: `backend/routes/ambassador.py` — COMPLETELY BROKEN

**Problems found**:
- All 17 endpoints had `current_user: dict = None` — NO authentication at all
- All 33 Motor (async) DB operations were missing `await` — would return coroutines instead of data
- `_get_unique_referral_code()` was a sync `def` calling async `db.ambassadors.find_one()` — would never work
- org_id resolution missing 3rd-level fallback

**Fixes applied**:
- Changed all 17 endpoints from `current_user: dict = None` to `current_user: dict = Depends(get_current_user)`
- Added `Depends` to imports
- Added `await` to all 33 Motor async DB operations
- Changed `_get_unique_referral_code` from `def` to `async def` and added `await`
- Removed broken `if not current_user: current_user = get_current_user()` pattern from all endpoints
- Added `or user.get("id")` third-level fallback to org_id resolution

### Fix 2: `backend/routes/ad_performance.py` — require_roles TypeError

**Problem**: Called `require_roles(current_user, ["Administrator"])` but function signature is `require_roles(allowed_roles: list)` — passing 2 args to a 1-param function. Would crash at runtime with TypeError.

**Fix**: Replaced with inline role checks:
```python
if current_user.get("role") not in ["Administrator", "Admin"]:
    raise HTTPException(status_code=403, detail="Admin access required")
```

Also removed unused `require_roles` import.

### Fix 3: `backend/routes/crm.py` — org_id resolution

**Problem**: `org_id = user.get("org_id") or user.get("team_id")` — missing 3rd-level fallback for users without org_id or team_id.

**Fix**: Changed to `org_id = user.get("org_id") or user.get("team_id") or user.get("id")`

### Fix 4: `backend/routes/knowledge_base.py` — org_id resolution

**Same fix as crm.py** — added `or user.get("id")` third-level fallback.

### Fix 5: `frontend/src/pages/AdPerformance.js` — Field name mismatches

**Problems**:
- Frontend used `monthly_trend` but backend returns `monthly_trends` (with 's')
- Frontend used `t.month` for date matching but backend returns `t.period` (YYYY-MM format)
- Frontend sent period as `YYYY-MM-DD` but backend expected `YYYY-MM`

**Fixes**: Updated all field references to match backend schema.

### Fix 6: Ad Performance 404 crash

**Problem**: Backend threw 404 when client had no snapshots. Frontend's fetch caught this as an error and showed "Error Loading Data" with no way to recover.

**Fix (backend)**: Return empty `ClientSummary` object instead of 404:
```python
if not snapshots:
    client_name = await get_client_name(client_id)
    return ClientSummary(
        client_id=client_id, client_name=client_name,
        current_month=None, previous_month=None,
        all_time_totals={"total_spend": 0, "total_leads": 0, ...},
        monthly_trends=[], active_platforms=[], platforms=[]
    )
```

**Fix (frontend)**: Also added 404 handling as empty state in the fetch logic.

---

## Phase 3: Preview-as-Client Mode — COMPLETE

### Problem

The AccountSwitcher in Layout.js lets admins set `preview_as_client=true` in localStorage along with `preview_client_id` and `preview_client_name`. But:
1. HomeRoute in App.js only checked `user?.role` — showed `CommandCenter` (admin dashboard) instead of `ClientHome`
2. Layout.js sidebar only checked `user?.role` — showed full admin nav instead of client nav
3. Every data-fetching page used the JWT token (admin's token) — showed admin's data, not the preview client's

### Root cause discovery

The `/` route doesn't use `Dashboard.js` at all. It uses `HomeRoute` in `App.js` which dispatches to `CommandCenter` (admin) or `ClientHome` (client). Dashboard.js is a separate component for `/dashboard` route if it exists.

### Fixes applied (6 files)

**`App.js` — HomeRoute**:
```javascript
function HomeRoute() {
  const { user } = useAuth();
  const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
  const isClient = isPreview || user?.account_type === 'Media Client' || user?.role === 'Media Client';
  if (isClient) return <ClientHome />;
  return <CommandCenter />;
}
```

**`Layout.js` — Sidebar nav**:
```javascript
const isPreviewClient = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const isClient = isPreviewClient || user?.role === 'Media Client' || user?.account_type === 'Media Client';
const mainItems = isClient ? NAV_CLIENT : filter(NAV_MAIN);
const businessItems = isClient ? [] : filter(NAV_BUSINESS);
const servicesItems = isClient ? [] : filter(NAV_SERVICES);
const systemItems = isClient ? [] : filter(NAV_SYSTEM);
```

**`ClientHome.js` — Preview data scoping**:
```javascript
const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
const previewClientName = isPreview ? localStorage.getItem('preview_client_name') : null;
const firstName = isPreview
  ? (previewClientName?.split(' ')[0] || 'Client')
  : (user?.name?.split(' ')[0] || 'there');
const url = isPreview && previewClientId
  ? `${API}/orders?requester_id=${previewClientId}`
  : `${API}/orders/my-requests`;
```

**`MyRequests.js` — Preview data scoping**:
```javascript
const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
const url = isPreview && previewClientId
  ? `${API}/orders?requester_id=${previewClientId}`
  : `${API}/orders/my-requests`;
```

**`Tasks.js` — Preview data scoping**:
```javascript
const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
const url = isPreview && previewClientId
  ? `${API}/tasks?assignee_user_id=${previewClientId}`
  : `${API}/tasks`;
```

**`Projects.js` — Preview data scoping**:
```javascript
const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;
const url = isPreview && previewClientId
  ? `${API}/projects?client_id=${previewClientId}`
  : `${API}/projects`;
```

---

## Phase 4: Mobile Responsive — IN PROGRESS

### CSS Changes Done (in `index.css`)

1. **Sidebar**: Removed `position: relative` from `.app-sidebar`. Added `@media (max-width: 1023px)` with `position: fixed; top: 0; left: 0; z-index: 50; box-shadow`. Tailwind classes in Layout.js handle the slide-in/out via `-translate-x-full lg:translate-x-0`.

2. **Top bar**: Added `@media (max-width: 1023px)` reducing padding. Added `@media (max-width: 767px)` hiding `kbd` elements and compacting buttons.

3. **Page content**: Added `@media (max-width: 767px)` reducing padding from `24px 28px` to `16px 12px`.

4. **Metric grids**: Added `@media (max-width: 500px)` making `.metrics-grid-4` and `.metrics-grid-3` single column.

5. **Two-col layout**: Added `@media (max-width: 900px)` stacking `.two-col` and making `.col-side` full width.

6. **Settings layout**: Added `@media (max-width: 767px)` stacking `.settings-layout` and making sidebar horizontal scrollable.

7. **New responsive utility classes**:
   - `.responsive-grid-4` / `.responsive-grid-3` / `.responsive-grid-2` — auto-collapse grids (4→2→1)
   - `.hide-mobile` — hidden below 768px
   - `.hide-desktop` — hidden above 768px
   - `.mobile-scroll-x` — horizontal scroll wrapper

8. **Modal**: Full-width bottom sheet on mobile (`@media (max-width: 600px)`)

9. **Panel slide**: Full viewport width on mobile

10. **Page header**: Stacks vertically on mobile, smaller font

11. **Quick actions grid**: Added `flex-wrap: wrap`

12. **Kanban**: Min-width 260px per column on mobile for horizontal scroll

13. **Data tables**: Smaller padding/font on mobile

14. **Command palette**: Adjusted for mobile viewport

### Still TODO (Not Done Yet)

1. **Layout.js top bar** — The search button shows `⌘K` kbd shortcut on mobile (should be hidden). The "New Request" button text could be icon-only on mobile. The breadcrumb could be simplified.

2. **CommandCenter.js** — Uses inline `style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}` for KPI cards and other grids. These can't be overridden by CSS media queries. Need to replace with the new `.responsive-grid-4` class or use `minmax()` / `auto-fill`.

3. **ClientHome.js** — Same issue: inline grid styles need to be replaced with responsive CSS classes.

4. **AdPerformance.js** — Same issue: inline grid styles for KPI cards and platform breakdown need responsive classes.

5. **Testing** — Need to verify all pages at 375px width (iPhone SE), 390px (iPhone 14), and 768px (iPad).

### How to approach the remaining mobile work

For each page (CommandCenter, ClientHome, AdPerformance):
1. Find all inline `style={{ display: 'grid', gridTemplateColumns: 'repeat(N, 1fr)' }}`
2. Replace with `className="responsive-grid-N"` (utility classes already exist in index.css)
3. For any `style={{ display: 'flex', gap: X }}` rows that should wrap on mobile, add `flexWrap: 'wrap'`
4. Check that any fixed-width elements (e.g., `width: 300px` sidebars) become `100%` on mobile
5. Test at 375px width

---

## Important Architecture Notes

### require_roles — How It Actually Works

```python
# In utils/auth.py:
def require_roles(allowed_roles: list):
    """Returns an async dependency function. Takes 1 arg (the list of roles)."""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        # checks user role against allowed_roles AND ROLE_ALIASES
        ...
    return role_checker

# CORRECT usage as FastAPI dependency:
@router.get("/endpoint")
async def my_endpoint(
    current_user: dict = Depends(require_roles(["Administrator"]))
):
    ...

# WRONG — this will TypeError (2 args to 1-param function):
# require_roles(current_user, ["Administrator"])

# ROLE_ALIASES dict maps:
# "Admin" → "Administrator"
# "Editor" → "Operator"
# etc.
# So require_roles(["Admin"]) will match users with role "Administrator"
```

### Preview-as-Client Pattern (for any new page)

Any page that shows client-scoped data needs this pattern:

```javascript
// At top of component
const isPreview = typeof window !== 'undefined' && localStorage.getItem('preview_as_client') === 'true';
const previewClientId = isPreview ? localStorage.getItem('preview_client_id') : null;

// In fetch logic
const url = isPreview && previewClientId
  ? `${API}/some-endpoint?client_id=${previewClientId}`
  : `${API}/some-endpoint/my-data`;
```

### Home Route Architecture

```
/ route → HomeRoute (App.js)
  ├── Admin (no preview) → CommandCenter.js
  └── Client OR Preview → ClientHome.js

/dashboard route → Dashboard.js (separate, rarely used)
```

### Order Status Flow

`Open → In Progress → Pending → Delivered → Closed` (or `Canceled` at any point)

### Org ID Resolution (backend)

Always use 3-level fallback:
```python
org_id = user.get("org_id") or user.get("team_id") or user.get("id")
```

---

## Files Modified This Session (Complete List)

### Backend
| File | Changes |
|------|---------|
| `backend/routes/ad_performance.py` | New file. 7 endpoints, Pydantic models, empty-state handling, inline role checks |
| `backend/routes/ambassador.py` | Fixed auth (17 endpoints), added await (33 calls), async function fix, org_id fix |
| `backend/routes/crm.py` | Added org_id 3rd-level fallback |
| `backend/routes/knowledge_base.py` | Added org_id 3rd-level fallback |

### Frontend
| File | Changes |
|------|---------|
| `frontend/src/App.js` | Added AdPerformance import, route, CLIENT_ALLOWED entry, preview mode to HomeRoute |
| `frontend/src/components/Layout.js` | Added Ad Performance to NAV_BUSINESS and NAV_CLIENT, preview mode to sidebar nav logic |
| `frontend/src/pages/AdPerformance.js` | New file. ~1300 lines. Client + Admin dashboards, field name fixes, preview support |
| `frontend/src/pages/ClientHome.js` | Added preview-as-client support (data scoping + display name) |
| `frontend/src/pages/MyRequests.js` | Added preview-as-client support (data scoping) |
| `frontend/src/pages/Tasks.js` | Added preview-as-client support (data scoping) |
| `frontend/src/pages/Projects.js` | Added preview-as-client support (data scoping) |
| `frontend/src/index.css` | Mobile responsive: sidebar, top bar, grids, modals, panels, utility classes |

### Config
| File | Changes |
|------|---------|
| `CLAUDE.md` | New file. Architecture reference for Claude Code |
| `SESSION_HANDOFF.md` | This file. Full session context |
