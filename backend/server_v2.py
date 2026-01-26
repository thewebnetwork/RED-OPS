"""
Red Ribbon Ops Portal API - V2 (Modular)

This is the refactored version using modular routes.
Run alongside server.py for testing, then gradually migrate.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

# Import modular routes
from routes import (
    auth_router,
    users_router,
    roles_router,
    teams_router,
    dashboard_router,
    notifications_router,
)

# Create FastAPI app
app = FastAPI(
    title="Red Ribbon Ops Portal API - V2",
    description="Modular version of the API",
    version="2.0.0"
)

# CORS middleware
origins = os.environ.get("CORS_ORIGINS", "").split(",") + ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(roles_router, prefix="/api")
app.include_router(teams_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Red Ribbon Ops Portal API V2", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
