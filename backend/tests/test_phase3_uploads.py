"""
Phase 3 Tests â€” Content Versioning & File Uploads.

Tests:
  1. Upload creates ContentVersion with version_number=1
  2. Second upload increments to version_number=2
  3. Checksum is deterministic (same bytes â†’ same sha256)
"""
from __future__ import annotations

import hashlib
import io
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient

from app.models.campaign import Campaign, CampaignStatus
from app.models.client import Client
from app.models.deliverable import Deliverable
from tests.conftest import TestSessionLocal, _make_token, _create_user_and_agency


# ---------------------------------------------------------------------------
# Helper: build a deliverable in DB, return (agency_id, deliverable_id, token)
# ---------------------------------------------------------------------------


async def _setup_deliverable(suffix: str) -> tuple[str, str, str]:
    async with TestSessionLocal() as db:
        user, agency, _ = await _create_user_and_agency(
            db,
            email=f"upload_{suffix}@test.com",
            agency_name=f"Upload Agency {suffix}",
            agency_slug=f"upload-{suffix}",
        )
        client_obj = Client(
            id=uuid.uuid4(),
            agency_id=agency.id,
            business_name=f"Upload Client {suffix}",
            industry="tech",
            status="active",
        )
        db.add(client_obj)
        await db.flush()

        campaign_obj = Campaign(
            id=uuid.uuid4(),
            client_id=client_obj.id,
            name="Upload Campaign",
            status=CampaignStatus.approved,
        )
        db.add(campaign_obj)
        await db.flush()

        deliverable_obj = Deliverable(
            id=uuid.uuid4(),
            campaign_id=campaign_obj.id,
            title="Test Reel",
            deliverable_type="reel",
            platform="instagram",
        )
        db.add(deliverable_obj)
        await db.commit()

        token = _make_token(user.id)
        return str(agency.id), str(deliverable_obj.id), token


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_upload_creates_version(agency_a_client: AsyncClient, agency_a_data):
    """Upload a file â†’ ContentVersion with version_number=1 is created."""
    _, agency = agency_a_data

    async with TestSessionLocal() as db:
        client_obj = Client(
            id=uuid.uuid4(), agency_id=agency.id,
            business_name="V1 Client", industry="tech", status="active",
        )
        db.add(client_obj)
        await db.flush()
        campaign_obj = Campaign(
            id=uuid.uuid4(), client_id=client_obj.id,
            name="V1 Campaign", status=CampaignStatus.approved,
        )
        db.add(campaign_obj)
        await db.flush()
        deliverable_obj = Deliverable(
            id=uuid.uuid4(), campaign_id=campaign_obj.id,
            title="V1 Reel", deliverable_type="reel", platform="instagram",
        )
        db.add(deliverable_obj)
        await db.commit()
        deliverable_id = str(deliverable_obj.id)

    img_bytes = b"fake-reel-content-v1"
    r = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliverable_id}/versions",
        files={"file": ("test.jpg", io.BytesIO(img_bytes), "image/jpeg")},
        data={"caption": "First cut", "notes": "Draft v1"},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["version_number"] == 1
    assert data["file_name"] == "test.jpg"
    assert data["caption"] == "First cut"
    assert data["checksum_sha256"] == hashlib.sha256(img_bytes).hexdigest()


@pytest.mark.asyncio
async def test_second_upload_increments_version(agency_a_client: AsyncClient, agency_a_data):
    """Second upload on same deliverable â†’ version_number=2."""
    _, agency = agency_a_data

    async with TestSessionLocal() as db:
        client_obj = Client(
            id=uuid.uuid4(), agency_id=agency.id,
            business_name="V2 Client", industry="tech", status="active",
        )
        db.add(client_obj)
        await db.flush()
        campaign_obj = Campaign(
            id=uuid.uuid4(), client_id=client_obj.id,
            name="V2 Campaign", status=CampaignStatus.approved,
        )
        db.add(campaign_obj)
        await db.flush()
        deliverable_obj = Deliverable(
            id=uuid.uuid4(), campaign_id=campaign_obj.id,
            title="V2 Reel", deliverable_type="reel", platform="instagram",
        )
        db.add(deliverable_obj)
        await db.commit()
        deliverable_id = str(deliverable_obj.id)

    for expected_version in [1, 2]:
        content = f"content-version-{expected_version}".encode()
        r = await agency_a_client.post(
            f"/agencies/{agency.id}/deliverables/{deliverable_id}/versions",
            files={"file": ("reel.mp4", io.BytesIO(content), "video/mp4")},
        )
        assert r.status_code == 201, r.text
        assert r.json()["version_number"] == expected_version


@pytest.mark.asyncio
async def test_checksum_is_deterministic(agency_a_client: AsyncClient, agency_a_data):
    """Same bytes â†’ same sha256 checksum every time."""
    _, agency = agency_a_data

    async with TestSessionLocal() as db:
        client_obj = Client(
            id=uuid.uuid4(), agency_id=agency.id,
            business_name="Checksum Client", industry="food", status="active",
        )
        db.add(client_obj)
        await db.flush()
        campaign_obj = Campaign(
            id=uuid.uuid4(), client_id=client_obj.id,
            name="Checksum Campaign", status=CampaignStatus.approved,
        )
        db.add(campaign_obj)
        await db.flush()
        deliverable_obj = Deliverable(
            id=uuid.uuid4(), campaign_id=campaign_obj.id,
            title="Checksum Reel", deliverable_type="reel", platform="instagram",
        )
        db.add(deliverable_obj)
        await db.commit()
        deliverable_id = str(deliverable_obj.id)

    img_bytes = b"deterministic-test-bytes-12345"
    expected_checksum = hashlib.sha256(img_bytes).hexdigest()

    r = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliverable_id}/versions",
        files={"file": ("img.png", io.BytesIO(img_bytes), "image/png")},
    )
    assert r.status_code == 201, r.text
    assert r.json()["checksum_sha256"] == expected_checksum


@pytest.mark.asyncio
async def test_document_uploads_support(agency_a_client: AsyncClient, agency_a_data):
    """Deliverable versions support document uploads (.pdf, .docx, .txt) alongside video/images."""
    _, agency = agency_a_data

    async with TestSessionLocal() as db:
        client_obj = Client(
            id=uuid.uuid4(), agency_id=agency.id,
            business_name="Document Client", industry="tech", status="active",
        )
        db.add(client_obj)
        await db.flush()
        campaign_obj = Campaign(
            id=uuid.uuid4(), client_id=client_obj.id,
            name="Docs Campaign", status=CampaignStatus.approved,
        )
        db.add(campaign_obj)
        await db.flush()
        deliverable_obj = Deliverable(
            id=uuid.uuid4(), campaign_id=campaign_obj.id,
            title="Script Reel", deliverable_type="reel", platform="instagram",
        )
        db.add(deliverable_obj)
        await db.commit()
        deliverable_id = str(deliverable_obj.id)

    # 1. Plain text script upload
    txt_content = b"Hook: Did you know this secret about Pune misal?\nBody: It uses 15 spices.\nCTA: Visit today!"
    r1 = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliverable_id}/versions",
        files={"file": ("reel_script.txt", io.BytesIO(txt_content), "text/plain")},
        data={"caption": "Misal Reel Script", "notes": "Draft script v1"},
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["file_name"] == "reel_script.txt"
    assert r1.json()["version_number"] == 1

    # 2. PDF script / storyboard upload
    pdf_content = b"%PDF-1.4 Fake PDF Content"
    r2 = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliverable_id}/versions",
        files={"file": ("storyboard.pdf", io.BytesIO(pdf_content), "application/pdf")},
        data={"caption": "Storyboard PDF", "notes": "V2 Storyboard"},
    )
    assert r2.status_code == 201, r2.text
    assert r2.json()["file_name"] == "storyboard.pdf"
    assert r2.json()["version_number"] == 2

    # 3. Word document script upload
    docx_content = b"PK\x03\x04Fake DOCX Content"
    r3 = await agency_a_client.post(
        f"/agencies/{agency.id}/deliverables/{deliverable_id}/versions",
        files={"file": ("final_script.docx", io.BytesIO(docx_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"caption": "Final Word Doc Script", "notes": "Final Script"},
    )
    assert r3.status_code == 201, r3.text
    assert r3.json()["file_name"] == "final_script.docx"
    assert r3.json()["version_number"] == 3

