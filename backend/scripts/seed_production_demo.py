"""
Production-Ready Seed Script for AgencyOS.

Populates the live database with a domain-agnostic enterprise agency hierarchy:
- Agency: Apex Global Creative
- Agency Team: admin@agencyos.io, director@agencyos.io, manager@agencyos.io
- Client: Vertex Cloud Technologies (Enterprise Cloud & Infrastructure)
- Client Social Account: Instagram (@vertexcloud_tech)
- Retainer Contract & Active Campaign: Q1 Global Brand Expansion
- Sample deliverables, publication jobs, and studio tasks

Strictly adheres to domain-agnostic constraints (zero food or restaurant tropes).
Idempotent: safe to run repeatedly against Neon PostgreSQL or local environments.
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

# Ensure project root is in sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select
from app.core.config import settings
from app.core.database import AsyncSessionLocal, async_engine
from app.core.security import hash_password
from app.models.agency import Agency
from app.models.brand_profile import BrandProfile
from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client, ClientStatus
from app.models.client_social_account import ClientSocialAccount
from app.models.contract import Contract, ContractStatus, ScopeItem
from app.models.content_version import ContentVersion
from app.models.deliverable import Deliverable, DeliverableStatus
from app.models.publication_job import JobStatus, PublicationJob
from app.models.task import Task, TaskPriority, TaskStatus
from app.models.user import Membership, RoleEnum, User


async def seed_production_demo() -> None:
    print(f"[*] Starting AgencyOS enterprise seed against {settings.APP_ENV} database...")
    print(f"[*] Target DB URL scheme: {str(async_engine.url).split('://')[0]}")

    async with AsyncSessionLocal() as session:
        # 1. Agency
        agency_slug = "apex-global"
        agency_res = await session.execute(select(Agency).where(Agency.slug == agency_slug))
        agency = agency_res.scalars().first()

        if not agency:
            agency = Agency(
                id=uuid.uuid4(),
                name="Apex Global Creative",
                slug=agency_slug,
                timezone="UTC",
            )
            session.add(agency)
            await session.flush()
            print(f"[+] Created Agency: {agency.name} ({agency.id})")
        else:
            print(f"[-] Existing Agency found: {agency.name} ({agency.id})")

        # 2. Team Members
        users_data = [
            ("admin@agencyos.io", "Admin1234!", RoleEnum.owner),
            ("director@agencyos.io", "Director1234!", RoleEnum.strategist),
            ("manager@agencyos.io", "Manager1234!", RoleEnum.account_manager),
            ("harshadpotdar02@gmail.com", "Admin1234!", RoleEnum.owner),
        ]

        admin_user = None
        for email, password, role in users_data:
            user_res = await session.execute(select(User).where(User.email == email))
            user = user_res.scalars().first()
            if not user:
                user = User(
                    id=uuid.uuid4(),
                    email=email,
                    hashed_password=hash_password(password),
                    is_active=True,
                )
                session.add(user)
                await session.flush()
                print(f"[+] Created User: {email}")

            if email == "admin@agencyos.io":
                admin_user = user

            # Check membership
            mem_res = await session.execute(
                select(Membership).where(
                    Membership.user_id == user.id,
                    Membership.agency_id == agency.id,
                )
            )
            membership = mem_res.scalars().first()
            if not membership:
                membership = Membership(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    agency_id=agency.id,
                    role=role,
                )
                session.add(membership)
                print(f"[+] Assigned {email} as {role.value} to {agency.name}")

        await session.flush()

        # 3. Client
        client_name = "Vertex Cloud Technologies"
        client_res = await session.execute(
            select(Client).where(Client.agency_id == agency.id, Client.business_name == client_name)
        )
        client = client_res.scalars().first()

        if not client:
            client = Client(
                id=uuid.uuid4(),
                agency_id=agency.id,
                business_name=client_name,
                industry="Enterprise Cloud & Infrastructure",
                website="https://vertexcloud.io",
                location="San Francisco, CA",
                contact_person="Sarah Jenkins",
                contact_email="sarah.jenkins@vertexcloud.example",
                status=ClientStatus.active,
            )
            session.add(client)
            await session.flush()
            print(f"[+] Created Client: {client.business_name} ({client.id})")
        else:
            print(f"[-] Existing Client found: {client.business_name} ({client.id})")

        # 4. Brand Profile
        bp_res = await session.execute(select(BrandProfile).where(BrandProfile.client_id == client.id))
        brand_profile = bp_res.scalars().first()
        if not brand_profile:
            brand_profile = BrandProfile(
                id=uuid.uuid4(),
                client_id=client.id,
                brand_voice="Technical, authoritative, minimalist, performance-driven",
                tone_examples=[
                    "Infrastructure that scales before demand spikes.",
                    "Zero downtime is our architectural standard.",
                ],
                target_audience={
                    "primary": "VP of Engineering, Cloud Architects, and DevOps Teams",
                    "industries": ["Cloud Computing", "Fintech", "Enterprise Infrastructure"],
                },
                content_pillars=[
                    "Architecture Deep Dives",
                    "Throughput & Reliability",
                    "Customer Scaling Stories",
                ],
                prohibited_claims=["100% bug-free guarantee", "Cheapest cloud provider"],
                is_confirmed=True,
            )
            session.add(brand_profile)
            await session.flush()
            print("[+] Seeded Brand Profile for Vertex Cloud Technologies")

        # 5. Connected Client Social Account
        soc_res = await session.execute(
            select(ClientSocialAccount).where(
                ClientSocialAccount.client_id == client.id,
                ClientSocialAccount.platform == "instagram",
            )
        )
        social_acc = soc_res.scalars().first()
        if not social_acc:
            social_acc = ClientSocialAccount(
                id=uuid.uuid4(),
                client_id=client.id,
                platform="instagram",
                account_name="Vertex Cloud Tech",
                account_handle="@vertexcloud_tech",
                instagram_business_id="17841400000000001",
                access_token="sandbox_token_vertex_01",
                is_active=True,
            )
            session.add(social_acc)
            await session.flush()
            print("[+] Seeded Instagram Social Account for Vertex Cloud Technologies")

        # 6. Retainer Contract & Scope
        contract_res = await session.execute(
            select(Contract).where(Contract.client_id == client.id, Contract.name == "Annual Cloud Retainer")
        )
        contract = contract_res.scalars().first()
        if not contract:
            contract = Contract(
                id=uuid.uuid4(),
                client_id=client.id,
                name="Annual Cloud Retainer",
                monthly_fee_inr=85000,
                start_date=date.today().replace(day=1),
                status=ContractStatus.active,
            )
            session.add(contract)
            await session.flush()

            scope_reel = ScopeItem(
                id=uuid.uuid4(),
                contract_id=contract.id,
                deliverable_type="reel",
                platform="instagram",
                monthly_quantity=12,
            )
            scope_carousel = ScopeItem(
                id=uuid.uuid4(),
                contract_id=contract.id,
                deliverable_type="carousel",
                platform="linkedin",
                monthly_quantity=8,
            )
            session.add_all([scope_reel, scope_carousel])
            await session.flush()
            print("[+] Seeded Annual Retainer Contract with 20 monthly deliverables")

        # 7. Campaign
        curr_month = date.today().month
        curr_year = date.today().year
        camp_res = await session.execute(
            select(Campaign).where(Campaign.client_id == client.id, Campaign.name == "Q1 Global Brand Expansion")
        )
        campaign = camp_res.scalars().first()
        if not campaign:
            campaign = Campaign(
                id=uuid.uuid4(),
                client_id=client.id,
                name="Q1 Global Brand Expansion",
                period_month=curr_month,
                period_year=curr_year,
                status=CampaignStatus.in_production,
                objective="Drive enterprise developer awareness and demo signups across cloud infrastructure",
            )
            session.add(campaign)
            await session.flush()
            print(f"[+] Created Campaign: {campaign.name} ({campaign.id})")

        # 8. Deliverables & Auto-Scheduled Publication Job
        deliv_res = await session.execute(
            select(Deliverable).where(Deliverable.campaign_id == campaign.id)
        )
        deliverables = deliv_res.scalars().all()
        if not deliverables:
            now_utc = datetime.now(timezone.utc)
            schedule_time = now_utc + timedelta(days=2, hours=4)

            # Deliverable 1: Scheduled Reel
            deliv1 = Deliverable(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                title="Next-Gen Architecture Breakdown",
                deliverable_type="reel",
                platform="instagram",
                status=DeliverableStatus.scheduled,
                scheduled_at=schedule_time,
                scheduled_timezone="UTC",
            )
            session.add(deliv1)
            await session.flush()

            # Content Version
            v1 = ContentVersion(
                id=uuid.uuid4(),
                deliverable_id=deliv1.id,
                version_number=1,
                caption="Scale your cloud infrastructure without breaking throughput. Full technical benchmark in bio.",
                storage_key="seed/sample_architecture_reel.mp4",
                file_name="sample_architecture_reel.mp4",
                file_type="video/mp4",
                file_size_bytes=1048576,
                checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                uploaded_by_id=admin_user.id,
            )
            session.add(v1)
            await session.flush()

            # Publication Job
            pub_job = PublicationJob(
                id=uuid.uuid4(),
                deliverable_id=deliv1.id,
                content_version_id=v1.id,
                client_social_account_id=social_acc.id,
                platform="instagram",
                publication_operation_id=uuid.uuid4(),
                status=JobStatus.scheduled,
                scheduled_at=schedule_time,
                scheduled_timezone="UTC",
                next_attempt_at=schedule_time,
                caption_snapshot=v1.caption,
                media_url_snapshot=f"https://s3.us-east-005.backblazeb2.com/agencyos-bucket/{v1.storage_key}",
                share_to_feed=True,
            )
            session.add(pub_job)

            # Deliverable 2: Approved Carousel
            deliv2 = Deliverable(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                title="5 High-Throughput Scaling Patterns",
                deliverable_type="carousel",
                platform="linkedin",
                status=DeliverableStatus.approved,
            )
            session.add(deliv2)

            # Deliverable 3: Internal Review Video
            deliv3 = Deliverable(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                title="Zero-Downtime Migration Blueprint",
                deliverable_type="video",
                platform="instagram",
                status=DeliverableStatus.internal_review,
            )
            session.add(deliv3)
            await session.flush()

            # Sample Tasks
            if admin_user:
                task1 = Task(
                    id=uuid.uuid4(),
                    deliverable_id=deliv1.id,
                    assignee_id=admin_user.id,
                    title="Render High-Bitrate Video Export",
                    task_type="video_editing",
                    status=TaskStatus.done,
                    priority=TaskPriority.high,
                )
                task2 = Task(
                    id=uuid.uuid4(),
                    deliverable_id=deliv3.id,
                    assignee_id=admin_user.id,
                    title="Motion Graphics Tuning",
                    task_type="design",
                    status=TaskStatus.in_progress,
                    priority=TaskPriority.medium,
                )
                session.add_all([task1, task2])

            await session.flush()
            print("[+] Seeded 3 production deliverables, 1 publication job, and 2 linked tasks")

        await session.commit()
        print("[✓] Enterprise demo seed completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_production_demo())
