# Iframe Embedding & Mobile Responsiveness Guide

## Overview

This application supports embedding inside other web applications (iframes) and is fully mobile responsive.

## Iframe Embedding Configuration

### Environment Variables

Configure iframe embedding behavior via these backend environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOW_IFRAME_EMBEDDING` | `true` | Set to `false` to restrict embedding |
| `FRAME_ANCESTORS` | `*` | Space-separated list of allowed parent domains |

### Examples

**Allow embedding from anywhere (development):**
```env
ALLOW_IFRAME_EMBEDDING=true
FRAME_ANCESTORS=*
```

**Allow embedding only from specific domains (production):**
```env
ALLOW_IFRAME_EMBEDDING=true
FRAME_ANCESTORS=https://myapp.example.com https://nextcloud.mycompany.com
```

**Restrict embedding entirely:**
```env
ALLOW_IFRAME_EMBEDDING=false
```

### Headers Set

When `ALLOW_IFRAME_EMBEDDING=true`:
- `Content-Security-Policy: frame-ancestors *` (or specified domains)
- No `X-Frame-Options` header (removed to allow embedding)

When `ALLOW_IFRAME_EMBEDDING=false`:
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy: frame-ancestors 'self'`

## Authentication

The app uses JWT tokens stored in `localStorage`, which are iframe-compatible:
- Tokens are sent via `Authorization: Bearer <token>` header
- No cookies are used for authentication
- Works correctly when embedded in iframes

## Mobile Responsiveness

### Breakpoints

The app uses Tailwind CSS responsive breakpoints:

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktops |
| `xl` | 1280px | Large screens |

### Key Mobile Features

1. **Collapsible Sidebar**
   - Hidden by default on mobile (`lg:hidden`)
   - Slides in when menu button is tapped
   - Backdrop overlay for focus

2. **Responsive Grids**
   - Dashboard: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5`
   - Forms: `grid-cols-1 lg:grid-cols-3`

3. **Touch-Friendly**
   - Minimum tap target size: 44px
   - Adequate spacing between interactive elements

4. **Mobile Navigation**
   - Hamburger menu button (`data-testid="mobile-menu-btn"`)
   - Full-height sliding sidebar
   - User info at bottom of sidebar

### Pages Optimized for Mobile

- ✅ Login
- ✅ Dashboard (Admin, Editor, Requester)
- ✅ Command Center (ticket creation)
- ✅ Orders list
- ✅ Teams management
- ✅ Categories
- ✅ Workflows list
- ✅ Settings pages

### Workflow Editor on Mobile

The Workflow Editor uses ReactFlow which supports touch interactions:
- Pan with one finger drag
- Zoom with pinch gestures
- Controls panel in bottom-left

Note: Complex workflow editing is best done on tablet or desktop.

## Docker Deployment

For self-hosted Docker deployment:

```dockerfile
# Backend environment
ENV ALLOW_IFRAME_EMBEDDING=true
ENV FRAME_ANCESTORS=https://your-parent-app.com
```

## Reverse Proxy Configuration

If using a reverse proxy (nginx, Traefik), ensure it doesn't override the CSP headers:

```nginx
# nginx example - don't set X-Frame-Options as the app handles it
# proxy_hide_header X-Frame-Options;  # Optional if proxy adds it
```

## Testing Embedding

To test iframe embedding locally:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Iframe Test</title>
</head>
<body>
    <iframe 
        src="http://localhost:3000" 
        width="100%" 
        height="800px"
        style="border: none;"
    ></iframe>
</body>
</html>
```
