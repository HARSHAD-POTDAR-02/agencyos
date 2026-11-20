export interface SceneCardData {
  scene_number: number;
  start_ms?: number;
  end_ms?: number;
  timestamp_range: string;
  shot_type: string;
  visual_action: string;
  voiceover_script: string;
  on_screen_text: string;
  audio_sfx_cue?: string;
  b_roll_notes?: string;
  ai_visual_prompt?: string;
  hero_focus?: string[];
}

export interface StoryboardPayload {
  deliverable_title: string;
  platform?: string;
  format_type?: string;
  target_duration_seconds?: number;
  strategic_pillar?: string;
  scenes: SceneCardData[];
  full_caption?: string;
  hashtags?: string[];
  call_to_action?: string;
  hero_entities?: string[];
}

export interface HookCardData {
  hook_id: string;
  opening_line: string;
  framework: string;
  psychological_trigger: string;
  clarity_rating: string;
  fluff_detected: boolean;
  pros: string;
  cons: string;
}

export interface HookComparisonPayload {
  topic: string;
  target_audience: string;
  hooks: HookCardData[];
  recommended_hook_id?: string;
}

export interface CarouselSlideData {
  slide_number: number;
  headline: string;
  body_copy: string;
  visual_layout_note: string;
  illustration_prompt?: string;
}

export interface CarouselDeckPayload {
  deliverable_title: string;
  slides: CarouselSlideData[];
  full_caption?: string;
  hashtags?: string[];
  call_to_action?: string;
}

export interface ComplianceCheckData {
  check_name: string;
  check_type: "deterministic" | "semantic_ai";
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  flagged_snippet?: string;
  explanation: string;
  suggested_correction?: string;
  is_blocking: boolean;
}

export interface CompliancePayload {
  checks: ComplianceCheckData[];
  has_blocking_violations: boolean;
  original_text?: string;
  proposed_diff?: string;
}

export interface EvidenceCitationData {
  source_title: string;
  source_url: string;
  publisher: string;
  publication_date?: string;
  excerpt: string;
  is_direct_quote?: boolean;
}

export interface CompetitorActivityData {
  competitor_name: string;
  platform: string;
  observed_creative_angle: string;
  observed_format: string;
  citation: EvidenceCitationData;
}

export interface InferredOpportunityData {
  opportunity_description: string;
  target_whitespace: string;
  supporting_citations: EvidenceCitationData[];
}

export interface ResearchEvidencePayload {
  query_topic: string;
  observed_competitors: CompetitorActivityData[];
  inferred_opportunities: InferredOpportunityData[];
  search_limitations?: string;
}

export interface NarrativeStageData {
  stage_name: string;
  days_range: string;
  core_message: string;
  deliverable_focus: string[];
}

export interface CampaignBlueprintPayload {
  campaign_theme: string;
  master_slogan: string;
  narrative_stages: NarrativeStageData[];
  format_mix_ratios: Record<string, number>;
}

export interface TruthTierItemData {
  tier: "verified_fact" | "inferred_pattern" | "hypothesis" | "missing_critical_info";
  attribute_key: string;
  content: string;
  source_ref?: string;
}

export interface BrandPositioningPayload {
  brand_name: string;
  truth_tier_items: TruthTierItemData[];
  clarifying_questions: string[];
}

export interface ActiveArtifactData {
  id: string;
  campaign_id?: string;
  chat_id?: string;
  type: string;
  title: string;
  version: number;
  status: string;
  payload: Record<string, any>;
  supporting_evidence_refs?: Array<Record<string, any>>;
}

export interface ExportPipelineRequest {
  artifact_id: string;
  expected_version_number: number;
  assignee_id?: string | null;
  default_due_date?: string | null;
  target_format?: string | null;
  deliverable_name?: string | null;
  artifact_type?: string | null;
  artifact_payload?: Record<string, any> | null;
}

export interface ExportPipelineResponse {
  is_replay: boolean;
  export_id: string;
  deliverable_id: string;
  task_id: string;
  deliverable_title: string;
  task_title: string;
  exported_at: string;
}

