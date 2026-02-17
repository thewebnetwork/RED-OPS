"""
Supabase Database Client - PostgreSQL Adapter
Replaces MongoDB connection
"""
import os
from supabase import create_client, Client
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class SupabaseDB:
    """Supabase PostgreSQL client wrapper"""
    
    def __init__(self):
        self.url: str = os.environ.get("SUPABASE_URL", "")
        self.key: str = os.environ.get("SUPABASE_ANON_KEY", "")
        self.client: Optional[Client] = None
        
        if self.url and self.key:
            try:
                self.client = create_client(self.url, self.key)
                logger.info("✓ Supabase client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Supabase: {e}")
                raise
        else:
            logger.warning("Supabase credentials not found in environment")
    
    def get_client(self) -> Client:
        """Get Supabase client instance"""
        if not self.client:
            raise Exception("Supabase client not initialized")
        return self.client

# Global instance
supabase_db = SupabaseDB()

def get_supabase() -> Client:
    """Dependency to get Supabase client"""
    return supabase_db.get_client()
