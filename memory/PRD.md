# RED RIBBON OPS PORTAL - Product Requirements Document

## Original Problem Statement
Build a simplified ticketing/order management system for video editing services. Replace WhatsApp + folder chaos with a single place to manage orders, communicate, and track deliverables.

## User Personas (3 Roles)
1. **Admin** - Full access to everything, manages users, sees all orders
2. **Editor** - Picks orders from pool, works on them, submits for review, delivers
3. **Requester** - Creates orders, reviews editor work, provides feedback

## Order Workflow (4 Statuses)
1. **Open** - New order created by Requester, visible in Editor pool
2. **In Progress** - Editor picked the order and is working on it
3. **Pending** - Editor submitted for review, waiting on Requester feedback
4. **Delivered** - Order completed

## Core Requirements
- JWT-based authentication
- Role-based dashboards (each role sees different view)
- Order pool for Editors to pick from
- Editors can't see each other's picked orders
- Requesters only see their own orders
- SLA tracking (7 days deadline)
- Message thread per order
- File management with "Final Delivery" marking
- Email notifications (SMTP placeholder configured)

## What's Been Implemented (January 2026)

### Backend (100% Complete)
- JWT authentication with bcrypt password hashing
- User CRUD (Admin only)
- Order creation (Requester/Admin)
- Order workflow: pick, submit-for-review, respond, deliver
- Messages per order
- Files per order with final delivery marking
- Role-specific dashboard endpoints
- Notifications system
- SLA calculation and breach detection

### Frontend (100% Complete)
- Login page
- Role-specific dashboards:
  - **Admin**: KPI overview, all orders, user management
  - **Editor**: Order pool, my orders, SLA breaching alerts, responded orders
  - **Requester**: My orders by status, needs review section
- Order detail page with messages, files, action buttons
- Create order form
- User management (Admin)

## Admin Credentials
- Email: admin@redribbonops.com
- Password: admin123

## SMTP Configuration (In /app/backend/.env)
```
SMTP_HOST=""
SMTP_PORT=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_FROM="info@redribbonrealty.ca"
```

## Next Steps
1. Configure SMTP for real email notifications
2. Add file upload (currently URL-only)
3. Add order categories/tags
4. Add reporting/analytics
