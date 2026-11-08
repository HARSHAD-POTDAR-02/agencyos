from __future__ import annotations

from typing import Any

from app.campaign_intelligence.orchestration.state import CampaignState

__all__ = [
    "CampaignState",
    "create_campaign_graph",
    "run_campaign_pipeline",
    "route_quality_gate",
]


def __getattr__(name: str) -> Any:
    if name in ("create_campaign_graph", "run_campaign_pipeline", "route_quality_gate"):
        import app.campaign_intelligence.orchestration.graph as graph_mod
        return getattr(graph_mod, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


