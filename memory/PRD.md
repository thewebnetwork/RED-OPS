# RED RIBBON OPS PORTAL - Product Requirements Document

## Original Problem Statement
Build a simplified ticketing/order management system for video editing services. Replace WhatsApp + folder chaos with a single place to manage orders, communicate, and track deliverables.

**V2 Update**: Transform the app into a "Command Center" - a multi-purpose request portal handling various request types (Editing Services, Feature Requests, Bug Reports) using a two-level category system.

## User Personas (3 Roles)
1. **Admin** - Full access to everything, manages users and categories, sees all orders/requests
2. **Editor** - Picks orders from pool, works on them, submits for review, delivers
3. **Requester** - Creates orders/requests, reviews editor work, provides feedback

## Order Workflow (4 Statuses)
1. **Open** - New order created by Requester, visible in Editor pool
2. **In Progress** - Editor picked the order and is working on it
3. **Pending** - Editor submitted for review, waiting on Requester feedback
4. **Delivered** - Order completed

## V2 Command Center Features
### Request Types
1. **Editing Services** - Goes through editor workflow (pick → progress → review → deliver)
2. **Feature Requests** - Simple submission, tracked by Admin
3. **Bug Reports** - Incident reporting with severity, steps to reproduce

### Two-Level Category System
- **Level 1**: Media Services, Feature Requests, Bug Reports / Incidents
- **Level 2**: Subcategories under each L1 (e.g., Editing Services under Media Services)
- **Editor Workflow Flag**: Subcategories can trigger editor workflow (only Editing Services by default)

### New Pages
- **Command Center** (`/command-center`) - Unified request creation with category selection
- **Categories** (`/categories`) - Admin page to manage L1/L2 categories
- **Profile** (`/profile`) - User profile with avatar upload and password change

### UI Updates
- Sidebar: Command Center link, Categories (Admin only), Quick Links section
- Quick Links: "Request a Feature", "Report a Bug" - pre-select categories
- User Dropdown: Profile Settings link, avatar display

## What's Been Implemented (January 24, 2026)

### V1 MVP (Completed)
- JWT authentication with bcrypt password hashing
- User CRUD (Admin only)
- Order creation (Requester/Admin)
- Order workflow: pick, submit-for-review, respond, deliver
- Messages per order
- Files per order with final delivery marking
- Role-specific dashboards
- Notifications system (in-app)
- SLA calculation and breach detection

### V2 Command Center (Completed - January 24, 2026)
- **Backend**:
  - Categories L1/L2 CRUD endpoints
  - Feature Requests endpoints
  - Bug Reports endpoints
  - My Requests unified endpoint
  - Profile update/password change endpoints
  - Backward compatibility for legacy orders (normalize_order helper)
  
- **Frontend**:
  - Command Center page with dynamic forms based on category
  - Categories management page (Admin)
  - Profile settings page with avatar upload
  - Updated sidebar with Command Center and Quick Links
  - User dropdown with Profile Settings

## Admin Credentials
- Email: admin@redribbonops.com
- Password: admin123

## API Endpoints

### Authentication
- POST `/api/auth/login` - Login
- GET `/api/auth/me` - Get current user
- PATCH `/api/auth/profile` - Update profile (name, email, avatar)
- POST `/api/auth/change-password` - Change password

### Users (Admin only)
- GET `/api/users` - List all users
- POST `/api/users` - Create user
- PATCH `/api/users/{id}` - Update user
- DELETE `/api/users/{id}` - Delete user

### Categories
- GET `/api/categories/l1` - List L1 categories
- POST `/api/categories/l1` - Create L1 category (Admin)
- PATCH `/api/categories/l1/{id}` - Update L1 category (Admin)
- DELETE `/api/categories/l1/{id}` - Deactivate L1 category (Admin)
- GET `/api/categories/l2` - List L2 categories (filter by l1_id)
- POST `/api/categories/l2` - Create L2 category (Admin)
- PATCH `/api/categories/l2/{id}` - Update L2 category (Admin)
- DELETE `/api/categories/l2/{id}` - Deactivate L2 category (Admin)

### Orders (Editing Workflow)
- GET `/api/orders` - List orders (role-filtered)
- POST `/api/orders` - Create editing order
- GET `/api/orders/{id}` - Get order details
- POST `/api/orders/{id}/pick` - Editor picks order
- POST `/api/orders/{id}/submit-for-review` - Submit for review
- POST `/api/orders/{id}/respond` - Requester responds
- POST `/api/orders/{id}/deliver` - Mark as delivered

### Feature Requests
- GET `/api/feature-requests` - List feature requests
- POST `/api/feature-requests` - Create feature request
- GET `/api/feature-requests/{id}` - Get feature request
- PATCH `/api/feature-requests/{id}/status` - Update status (Admin)

### Bug Reports
- GET `/api/bug-reports` - List bug reports
- POST `/api/bug-reports` - Create bug report
- GET `/api/bug-reports/{id}` - Get bug report
- PATCH `/api/bug-reports/{id}/status` - Update status (Admin)

### Unified
- GET `/api/my-requests` - Get all requests for current user (Editing, Feature, Bug)

### Dashboard
- GET `/api/dashboard/stats` - Get dashboard statistics
- GET `/api/dashboard/editor` - Editor-specific dashboard data
- GET `/api/dashboard/requester` - Requester-specific dashboard data

### Notifications
- GET `/api/notifications` - List notifications
- PATCH `/api/notifications/{id}/read` - Mark as read
- PATCH `/api/notifications/read-all` - Mark all as read
- GET `/api/notifications/unread-count` - Get unread count

## SMTP Configuration (MOCKED)
```
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="info@redribbonrealty.ca"
```
Note: Email notifications are logged but not actually sent until SMTP is configured.

## Tech Stack
- **Frontend**: React, React Router, Axios, Shadcn/UI, TailwindCSS
- **Backend**: FastAPI, Pydantic, PyJWT, passlib
- **Database**: MongoDB (Motor async driver)

## Known Issues
- Login page missing data-testid attributes on inputs (minor)

## Future/Backlog Tasks
1. **P2**: Configure SMTP for real email notifications
2. **P2**: Implement GHL/Marketplace incoming webhook
3. **P2**: Implement GHL/Marketplace outgoing webhook for status updates
4. **P3**: Refactor server.py into modules (/routers, /models, /services)
5. **P3**: Add file upload (currently URL-only)
6. **P3**: Add reporting/analytics dashboard

## Test Reports
- `/app/test_reports/iteration_1.json` - V1 MVP testing
- `/app/test_reports/iteration_2.json` - Simplified workflow testing
- `/app/test_reports/iteration_3.json` - V2 Command Center testing (100% pass rate)
