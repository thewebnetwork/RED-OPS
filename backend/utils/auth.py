"""Authentication utilities"""
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from database import db
from config import SECRET_KEY, ALGORITHM

security = HTTPBearer()

# Role mapping for backward compatibility during migration
ROLE_ALIASES = {
    "Admin": "Administrator",
    "Manager": "Privileged User",
    "Requester": "Standard User",
    "Editor": "Operator",  # Workers/pickers are now Operators, not Standard Users
}

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        # Attach org context if user has a primary org
        primary_org_id = user.get("primary_org_id")
        if primary_org_id:
            membership = await db.org_members.find_one(
                {"user_id": user_id, "org_id": primary_org_id, "active": True},
                {"_id": 0}
            )
            if membership:
                user["org_id"] = primary_org_id
                user["org_role"] = membership.get("org_role", "member")
                user["org_permissions"] = membership.get("permissions", {})
            else:
                user["org_id"] = None
                user["org_role"] = None
                user["org_permissions"] = {}
        else:
            user["org_id"] = None
            user["org_role"] = None
            user["org_permissions"] = {}

        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_from_token(token: str) -> dict:
    """Decode a JWT token string and return the user dict. Used by SSE endpoint."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(allowed_roles: list):
    """Check if user has required role, with backward compatibility for old role names"""
    async def role_checker(user: dict = Depends(get_current_user)):
        user_role = user.get("role", "")
        
        # Check direct match first
        if user_role in allowed_roles:
            return user
        
        # Check if user's old role maps to an allowed new role
        mapped_role = ROLE_ALIASES.get(user_role)
        if mapped_role and mapped_role in allowed_roles:
            return user
        
        # Check reverse - if allowed role is an old name that maps to user's new role
        # e.g., allowed="Admin", user_role="Administrator" -> ROLE_ALIASES["Admin"]="Administrator"
        for allowed in allowed_roles:
            if allowed in ROLE_ALIASES:
                if ROLE_ALIASES[allowed] == user_role:
                    return user
        
        # Also check if checking for new role names and user has old role
        for allowed in allowed_roles:
            if allowed in ROLE_ALIASES.values():
                for old_role, new_role in ROLE_ALIASES.items():
                    if new_role == allowed and user_role == old_role:
                        return user
        
        raise HTTPException(status_code=403, detail="Permission denied")
    return role_checker


def require_admin(user: dict = Depends(get_current_user)):
    """Require user to be an Administrator"""
    user_role = user.get("role", "")
    if user_role in ["Administrator", "Admin"]:
        return user
    raise HTTPException(status_code=403, detail="Admin access required")
