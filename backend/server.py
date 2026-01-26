"""
Red Ribbon Ops Portal API

This file re-exports the modular server_v2 application.
The actual route implementations are in /app/backend/routes/
"""

# Re-export the app from the modular server
from server_v2 import app

# This file exists for backward compatibility with supervisor config
# which references server:app
