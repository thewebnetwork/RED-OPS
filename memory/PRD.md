# RED RIBBON OPS PORTAL - Product Requirements Document

## Original Problem Statement
Build a simplified ticketing/order management system for video editing services. Replace WhatsApp + folder chaos with a single place to manage orders, communicate, and track deliverables.

**V2 Update**: Transform the app into a "Command Center" - a multi-purpose request portal handling various request types using a two-level category system.

**V3 Update (Current)**: Transform into a "Service Hub Platform" with dynamic roles, custom workflows, and form builder capabilities.

## User Personas (Dynamic Roles)
Roles are now dynamic and stored in database. Initial seed includes:

### System Roles (2)
1. **Admin** - Full system access, manages users/roles/categories
2. **Requester** - Can submit requests and orders

### Service Provider Roles (29)
Real estate and marketing professionals who can pick orders from the pool:
- **Video/Photo**: Video Editor, Photographer, Videographer, Drone Operator
- **Staging**: Home Stager, Virtual Stager
- **Technical**: Floor Plan Designer, Home Inspector, Appraiser, Land Surveyor
- **Financial**: Mortgage Broker, Title Company
- **Trades**: General Contractor, Electrician, Plumber, HVAC Technician, Roofer, Painter, Landscaper, Cleaner, Pest Control, Locksmith
- **Marketing**: Graphic Designer, Social Media Manager, Copywriter, SEO Specialist, Web Developer, Print Specialist, Sign Installer

## Current Order Workflow (4 Statuses)
1. **Open** - New order created by Requester, visible in Service Provider pool
2. **In Progress** - Service Provider picked the order and is working on it
3. **Pending** - Service Provider submitted for review, waiting on Requester feedback
4. **Delivered** - Order completed

## What's Been Implemented

### Phase 1: Dynamic Roles System ✅ (January 24, 2026)
- **Backend**:
  - Roles CRUD endpoints (`/api/roles`)
  - Role validation for user creation/update
  - Pre-seeded 31 roles (2 system + 29 service providers)
  - `can_pick_orders` and `can_create_orders` permissions
  - System roles protected from modification/deletion
  
- **Frontend**:
  - Roles management page (`/roles`) with tabs by type
  - Role cards showing icon, color, description, permissions
  - Add/Edit role dialog with icon and color picker
  - Users page updated with dynamic role dropdown (grouped by type)
  - Sidebar updated with "Roles" link for Admin

### V2 Command Center ✅ (January 24, 2026)
- Command Center page with category-driven request forms
- 2-level category system (L1/L2)
- Feature Requests and Bug Reports tracking
- Profile page with avatar upload and password change
- Quick links for common actions

### V1 MVP ✅
- JWT authentication
- Order management workflow
- Messages and files per order
- Notifications system
- SLA tracking

## Admin Credentials
- Email: admin@redribbonops.com
- Password: admin123

## API Endpoints

### Roles
- GET `/api/roles` - List all roles (filter by role_type, active_only)
- GET `/api/roles/service-providers` - List service providers
- POST `/api/roles` - Create role (Admin)
- PATCH `/api/roles/{id}` - Update role (Admin, non-system only)
- DELETE `/api/roles/{id}` - Deactivate role (Admin, non-system only)

### Users (uses dynamic roles)
- POST `/api/users` - Create user with any valid role
- PATCH `/api/users/{id}` - Update user including role change

## Tech Stack
- **Frontend**: React, React Router, Axios, Shadcn/UI, TailwindCSS
- **Backend**: FastAPI, Pydantic, PyJWT, passlib
- **Database**: MongoDB (Motor async driver)

## MOCKED Features
- **SMTP email notifications** - Logged but not sent

## Next Phases (Roadmap)

### Phase 2: Visual Workflow Builder 🟡
- Flowchart-style canvas to design workflows
- Define status steps per workflow
- Connect workflows to roles
- Action triggers (notify, require approval)

### Phase 3: Full Form Builder 🟢
- Field types: Text, Textarea, Dropdown, Multi-select, File Upload, Date, Number, Checkbox, URL
- Drag-and-drop field ordering
- Required/optional settings
- Form preview

### Phase 4: UI Customization Engine 🔵
- All text/labels stored in database
- Admin "Customize UI" page
- Live preview of changes

## Test Reports
- `/app/test_reports/iteration_1.json` - V1 MVP
- `/app/test_reports/iteration_2.json` - Simplified workflow
- `/app/test_reports/iteration_3.json` - V2 Command Center (100% pass)
- `/app/test_reports/iteration_4.json` - Phase 1 Dynamic Roles (100% pass)
