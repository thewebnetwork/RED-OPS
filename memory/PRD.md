# RED RIBBON OPS PORTAL - Product Requirements Document

## Original Problem Statement
Build a web app to replace WhatsApp + folder chaos by giving Red Ribbon Group a single place to:
- Create and track orders (video edits + marketplace services)
- Communicate inside each order via a threaded chat (order-specific)
- Attach and version files per order
- Allow clients to review, request revisions, approve, and download deliverables

## User Personas
1. **Admin (Vitto/Lucca)** - Full access to everything, can create/edit/delete orders, users, clients
2. **Manager** - Can create/edit orders and clients, assign editors, view all orders
3. **Editor** - Can only view assigned orders, post messages, upload files, limited status transitions
4. **Client** - Can view their orders, post messages, approve/request revisions, download finals

## Core Requirements (Static)
- JWT-based authentication (email/password)
- Role-based access control (4 roles)
- Order management with status workflow
- Threaded messaging per order
- File management with version tracking
- "Latest Final Export" pinning feature
- Mobile-friendly order page
- Checklist per order
- Tickets system
- In-app notifications (SMTP email placeholder for future)
- Webhook placeholders for GHL integration

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT tokens with bcrypt password hashing
- **Database**: MongoDB with collections: users, clients, orders, order_messages, order_files, order_checklists, tickets, ticket_messages, notifications, activity_logs, counters

## What's Been Implemented (January 2026)
- ✅ Login page with JWT authentication
- ✅ Dashboard with KPI cards (New, In Progress, Needs Review, Revision Requested, Delivered 7 days)
- ✅ Orders list with filters (status, type, priority, editor, search)
- ✅ Order detail page with:
  - Message thread
  - Files tab with pin as final
  - Activity log tab
  - Checklist
  - Status dropdown with role-based transitions
- ✅ Create Order form (< 60 seconds)
- ✅ Clients management (CRUD)
- ✅ Users management (CRUD + role assignment)
- ✅ Tickets system with threading
- ✅ In-app notifications
- ✅ Auto-generated order codes (RRG-XXXXXX)
- ✅ Webhook endpoints (placeholders)
- ✅ Dark sidebar + light content area design

## Prioritized Backlog

### P0 - Critical (Complete)
- [x] Authentication system
- [x] Order CRUD
- [x] Message threading
- [x] File management
- [x] Status transitions

### P1 - High Priority (Next)
- [ ] Configure SMTP for email notifications
- [ ] Client portal view (simplified)
- [ ] Email notifications on status changes
- [ ] Mobile responsive testing

### P2 - Medium Priority
- [ ] Bulk order import
- [ ] Advanced search/filters
- [ ] Order templates
- [ ] File upload (not just URL)

### P3 - Low Priority / Future
- [ ] Full GHL webhook integration
- [ ] Analytics dashboard
- [ ] Audit logging
- [ ] Export reports

## Admin Credentials
- Email: info@redribbonrealty.ca
- Password: admin123
