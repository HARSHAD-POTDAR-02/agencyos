import pytest
from app.campaign_intelligence.schemas.strategy import CampaignStrategy


def test_campaign_strategy_string_dict_resilience():
    sample = {
        "campaign_theme": "Taste of Maharashtra",
        "primary_objective": "Brand awareness and foot traffic",
        "target_audience_definition": "Food lovers and families",
        "platform_distribution_strategy": "{'instagram': 'Primary video reach', 'linkedin': 'Business catering'}",
        "budget_allocation": "70% Instagram, 30% LinkedIn",
        "success_benchmarks": "Instagram engagement rate > 3.5%, 500 new followers",
        "pacing_and_cadence": "3 posts per week",
        "strategic_angles": [],
        "messaging_pillars": [
            {
                "pillar_name": "Authenticity",
                "core_message": "Real Kolhapuri recipes",
                "primary_call_to_action": "Visit us today",
                "target_emotions": "Nostalgia, Hunger, Excitement",
            }
        ],
        "assumptions_and_risks": ["High local competition"],
    }

    cs = CampaignStrategy.model_validate(sample)
    assert cs.platform_distribution_strategy == {"instagram": "Primary video reach", "linkedin": "Business catering"}
    assert cs.budget_allocation == {"instagram": 70.0, "linkedin": 30.0}
    assert cs.success_benchmarks == {"target": "Instagram engagement rate > 3.5%, 500 new followers"}
    assert cs.messaging_pillars[0].target_emotions == ["Nostalgia", "Hunger", "Excitement"]
