# Red Ribbon Operations Platform

Enterprise operations platform with client portal, operator console, and admin studio.

## 🚀 Quick Start

### Local Development
```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn server:app --reload --port 8001

# Frontend
cd frontend
npm install
npm start
```

### Production Deployment
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for complete instructions.

## Tech Stack
- **Frontend:** React + TailwindCSS + Shadcn/UI
- **Backend:** FastAPI (Python)
- **Database:** MongoDB (Motor async driver)
- **Hosting:** Vercel (Frontend) + Railway (Backend)

## Features
- 🌍 Multi-language support (EN/ES/PT)
- 👥 Role-based access control (RBAC)
- 📊 Real-time dashboards
- 🎯 SLA tracking
- 💬 Request management with messaging
- 📈 Analytics and reporting

## License
Proprietary - Red Ribbon Media
