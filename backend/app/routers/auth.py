from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import create_access_token
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services.auth_service import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserOut:
    """Register a new user account."""
    user = await register_user(
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        db=db,
    )
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Authenticate and return a JWT access token."""
    user = await authenticate_user(payload.email, payload.password, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Return the currently authenticated user with client role detection."""
    from sqlalchemy import select
    from app.models.client_reviewer import ClientReviewer
    from app.models.user import Membership, RoleEnum

    rev_res = await db.execute(
        select(ClientReviewer.id).where(ClientReviewer.user_id == current_user.id).limit(1)
    )
    is_reviewer = rev_res.scalar_one_or_none() is not None

    mem_res = await db.execute(
        select(Membership.role).where(
            Membership.user_id == current_user.id,
            Membership.is_active.is_(True),
        )
    )
    roles = set(mem_res.scalars().all())
    is_agency_staff = bool(roles & {RoleEnum.owner, RoleEnum.account_manager, RoleEnum.strategist, RoleEnum.designer})
    is_client = is_reviewer or (RoleEnum.client in roles and not is_agency_staff)

    out = UserOut.model_validate(current_user)
    out.is_client = is_client
    return out
