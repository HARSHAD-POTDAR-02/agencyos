# app/models/__init__.py
# Import all models here so SQLAlchemy's metadata is fully populated
# and Alembic autogenerate can detect all tables.

from app.models.agency import Agency  # noqa: F401
from app.models.user import Membership, RoleEnum, User  # noqa: F401
from app.models.client import Client, ClientStatus  # noqa: F401
from app.models.brand_profile import BrandProfile  # noqa: F401
from app.models.contract import Contract, ScopeItem  # noqa: F401
from app.models.campaign import Campaign, CampaignStatus  # noqa: F401
from app.models.deliverable import Deliverable, DeliverableStatus  # noqa: F401
from app.models.task import Task, TaskPriority, TaskStatus  # noqa: F401
from app.models.content_version import ContentVersion  # noqa: F401
from app.models.approval import Approval, ApprovalDecision  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.client_reviewer import ClientReviewer  # noqa: F401
from app.models.comment import DeliverableComment  # noqa: F401
from app.models.client_social_account import ClientSocialAccount  # noqa: F401
from app.models.publication_job import (  # noqa: F401
    PublicationJob,
    PublicationAttempt,
    JobStatus,
    AttemptStatus,
)
from app.models.studio_artifact import (  # noqa: F401
    CampaignStudioSession,
    StudioArtifact,
    StudioArtifactVersion,
    StudioExport,
    StudioArtifactType,
    StudioArtifactStatus,
)
from app.models.operational_workflow import (  # noqa: F401
    WorkflowRun,
    WorkflowRunStatus,
    WorkflowTask,
    WorkflowTaskStatus,
    TaskKind,
    AssigneeType,
    WorkflowDependency,
    WorkflowJobQueue,
    WorkflowJobStatus,
    WorkflowJobAttempt,
    JobErrorCategory,
    TaskOutputVersion,
    WorkflowTaskReview,
    ReviewDecision,
    ModelInvocation,
)
from app.models.social_comment import (  # noqa: F401
    SocialComment,
    SocialConversation,
    SocialMessage,
    CommentSentiment,
    EngagementStatus,
)
