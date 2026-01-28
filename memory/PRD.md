# Red Ops Platform - Product Requirements Document

## Overview
A comprehensive operations management platform designed as a request and fulfillment system for Partners, Media Clients, and Vendors.

## Current Version: 2.6 (UAT Round 2 Fixes - Jan 28, 2026)
**Last Updated:** January 28, 2026
**Platform Name:** Red Ops
**Preview URL:** https://ops-tracker-6.preview.emergentagent.com

---

## UAT Round 2 Fixes Completed

### A) Ticket Creation Fixed ✅
- **Issue:** Submit button not showing for some categories (e.g., Photography)
- **Fix:** Added `GenericRequestForm` that shows for ALL L2 category selections that don't have special forms
- **Result:** Submit button ALWAYS appears after L2 category selection

### B) Report an Issue Fixed ✅
- **Issue:** Page showing "Failed to load" 
- **Fix:** Same GenericRequestForm fix + proper error handling
- **Route:** `/command-center?type=issue`

### C) Opportunity Ribbon Clarification ✅
- **Behavior:** Pool shows UNASSIGNED tickets only (by design)
- **Assigned tickets:** Go to resolver's "My Assigned Tickets" (new endpoint)
- **New endpoint:** `GET /api/orders/my-assigned`

### D) Admin Force to Pool 2 ✅
- **New Feature:** Admin can bypass 24h right-of-first-refusal
- **Endpoint:** `POST /api/orders/{id}/force-pool-2`
- **UI:** "Force to Pool 2" button on OrderDetail for Admin
- **Requirements:** Ticket must be Open AND unassigned
- **Audit:** Logged with timestamp, admin name, reason

### E) Dashboard Button Removed ✅
- **Issue:** Duplicate "+NEW REQUEST" button
- **Fix:** Removed from Dashboard.js - users should use sidebar navigation

### F) My Tickets Renamed ✅
- **Old:** "My Tickets"
- **New:** "My Submitted Tickets"
- **Clarifies:** These are tickets the user submitted (not assigned to them)

---

## Pool System Explained

### Pool 1 (Partners)
- **Who sees it:** Partners
- **When tickets appear:** Immediately on creation
- **Contains:** Open + unassigned tickets

### Pool 2 (Vendors/Freelancers)
- **Who sees it:** Vendors/Freelancers
- **When tickets appear:** After 24 hours (right-of-first-refusal expired)
- **Contains:** Open + unassigned tickets, pool_entered_at > 24h ago
- **Admin override:** "Force to Pool 2" bypasses 24h wait

### Assigned Tickets
- **Where they go:** Removed from pools, appear in resolver's work queue
- **Endpoint:** `GET /api/orders/my-assigned`

---

## Key API Endpoints

### Orders
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orders` | POST | Create ticket |
| `/api/orders/my-requests` | GET | My submitted tickets |
| `/api/orders/my-assigned` | GET | Tickets assigned to me (resolver) |
| `/api/orders/pool/1` | GET | Pool 1 (Partners) |
| `/api/orders/pool/2` | GET | Pool 2 (Vendors) |
| `/api/orders/{id}/force-pool-2` | POST | Admin force to Pool 2 |
| `/api/orders/{id}/pick` | POST | Pick ticket from pool |
| `/api/orders/{id}/reassign` | POST | Reassign ticket |
| `/api/orders/{id}/reopen` | POST | Admin reopen closed ticket |
| `/api/orders/{id}/cancel` | POST | Requester cancel ticket |

### Announcements
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/announcements` | GET | List all (Admin) |
| `/api/announcements` | POST | Create |
| `/api/announcements/{id}` | PATCH | Update |
| `/api/announcements/{id}` | DELETE | Delete |
| `/api/announcements/active` | GET | Get active for user |

### IAM
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/iam/roles` | GET/POST | Role CRUD |
| `/api/iam/account-types` | GET/POST | Account Type CRUD |

---

## Forms in CommandCenter

| Form | Condition |
|------|-----------|
| EditingRequestForm | `triggers_editor_workflow` |
| FeatureRequestForm | L2 name matches "Feature Request" pattern |
| BugReportForm | L2 name matches "Bug" pattern |
| **GenericRequestForm** | **All other L2 selections** |

---

## Sidebar Navigation

### All Users
- Dashboard
- My Services
- **My Submitted Tickets** (renamed)
- Submit New Request
- Report an Issue
- Opportunity Ribbon (NOT for Media Clients)
- Reports

### Admin Only
- All Orders
- Identity & Access (6 tabs)
- Logs
- Announcements
- Settings

---

## Test Credentials
- **Admin:** admin@redribbonops.com / Fmtvvl171**

---

## Mocked Integrations
- **Email (SMTP):** MOCKED if SMTP credentials not configured
- **GHL Payment:** `/api/webhooks/ghl-payment-mock`

---

## Test Reports
- Latest: `/app/test_reports/iteration_32.json` (100% pass)

---

## File References

### Frontend (Key Changes)
- `CommandCenter.js` - GenericRequestForm added
- `OrderDetail.js` - Force to Pool 2 button
- `Dashboard.js` - +NEW REQUEST button removed
- `MyRequests.js` - Renamed to "My Submitted Tickets"
- `RibbonBoard.js` - Pool visibility (unassigned only)

### Backend (Key Changes)
- `routes/orders.py` - `/my-assigned`, `/force-pool-2` endpoints
- `routes/settings.py` - Announcements CRUD
- `services/email.py` - Email notification templates
