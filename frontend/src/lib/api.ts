/**
 * AgencyOS API client
 * Base URL points to FastAPI backend
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
};

async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, headers: customHeaders } = opts;

  const headers: Record<string, string> = { ...(customHeaders ?? {}) };
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    let errorMsg = `HTTP ${res.status}`;
    if (typeof error.detail === "string") {
      errorMsg = error.detail;
    } else if (Array.isArray(error.detail)) {
      errorMsg = error.detail.map((d: any) => d.msg || d.detail || JSON.stringify(d)).join("; ");
    } else if (error.detail && typeof error.detail === "object") {
      errorMsg = error.detail.msg || error.detail.detail || JSON.stringify(error.detail);
    } else if (typeof error.message === "string") {
      errorMsg = error.message;
    }
    throw new Error(errorMsg);
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return res.json() as Promise<T>;
}

/* ── Auth endpoints ── */
export const authApi = {
  register: (data: { email: string; password: string; full_name: string }) =>
    apiFetch("/auth/register", { method: "POST", body: data }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: data,
    }),

  me: (token: string) =>
    apiFetch("/auth/me", { token }),
};

export interface DashboardStats {
  clients_total: number;
  clients_active: number;
  clients_onboarding: number;
  clients_paused: number;
  clients_offboarded: number;
  tasks_total: number;
  tasks_remaining: number;
  tasks_high_priority: number;
  tasks_in_review: number;
  tasks_todo: number;
  deliverables_total: number;
  deliverables_done: number;
  deliverables_by_status: Record<string, number>;
  tasks_by_status: Record<string, number>;
  total_monthly_retainer_inr: number;
  active_contracts_count: number;
  recent_activity: Array<{
    id: string;
    kind: string;
    title: string;
    subtitle: string;
    status: string;
    timestamp: string;
  }>;
  upcoming_deadlines: Array<{
    id: string;
    title: string;
    client_name: string;
    due_date: string;
    days_remaining: number;
    task_type?: string | null;
  }>;
}

/* ── Agency endpoints ── */
export const agencyApi = {
  create: (data: { name: string }, token: string) =>
    apiFetch("/agencies", { method: "POST", body: data, token }),

  listMine: (token: string) =>
    apiFetch("/agencies/me", { token }),

  get: (agencyId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}`, { token }),

  listMembers: (agencyId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/members`, { token }),

  inviteMember: (
    agencyId: string,
    data: { email: string; role: string; full_name?: string; password?: string },
    token: string
  ) =>
    apiFetch(`/agencies/${agencyId}/members`, { method: "POST", body: data, token }),

  updateMemberRole: (
    agencyId: string,
    memberId: string,
    role: string,
    token: string
  ) =>
    apiFetch(`/agencies/${agencyId}/members/${memberId}`, {
      method: "PATCH",
      body: { role },
      token,
    }),

  removeMember: (agencyId: string, memberId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/members/${memberId}`, { method: "DELETE", token }),

  badgeCounts: (agencyId: string, token: string) =>
    apiFetch<{
      tasks_count: number;
      tasks_active: number;
      approvals_count: number;
      approvals_total: number;
    }>(`/agencies/${agencyId}/badge-counts`, { token }),

  dashboardStats: (agencyId: string, token: string) =>
    apiFetch<DashboardStats>(`/agencies/${agencyId}/dashboard-stats`, { token }),

  search: (agencyId: string, q: string, token: string) =>
    apiFetch<SearchResponse>(`/agencies/${agencyId}/search?q=${encodeURIComponent(q)}`, { token }),

  notifications: (agencyId: string, token: string) =>
    apiFetch<NotificationsResponse>(`/agencies/${agencyId}/notifications`, { token }),
};

export interface SearchItem {
  id: string;
  category: "client" | "deliverable" | "campaign" | "task";
  title: string;
  subtitle: string;
  url: string;
  badge?: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchItem[];
}

export interface NotificationItem {
  id: string;
  category: "approval" | "publish" | "task" | "client";
  title: string;
  description: string;
  timestamp: string;
  url: string;
  is_urgent?: boolean;
}

export interface NotificationsResponse {
  unread_count: number;
  notifications: NotificationItem[];
}

/* ── Client endpoints ── */
export const clientApi = {
  create: (agencyId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients`, { method: "POST", body: data, token }),

  list: (agencyId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients`, { token }),

  get: (agencyId: string, clientId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}`, { token }),

  update: (agencyId: string, clientId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}`, { method: "PATCH", body: data, token }),

  delete: (agencyId: string, clientId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}`, { method: "DELETE", token }),

  quota: (agencyId: string, clientId: string, month: number, year: number, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/quota?period_month=${month}&period_year=${year}`, { token }),

  getTasteMemory: (agencyId: string, clientId: string, token: string) =>
    apiFetch<any[]>(`/agencies/${agencyId}/clients/${clientId}/taste-memory`, { token }),

  addTasteRule: (agencyId: string, clientId: string, data: { category: string; rule: string; reason?: string }, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/clients/${clientId}/taste-memory`, { method: "POST", body: data, token }),

  deleteTasteRule: (agencyId: string, clientId: string, ruleId: string, token: string) =>
    apiFetch<void>(`/agencies/${agencyId}/clients/${clientId}/taste-memory/${ruleId}`, { method: "DELETE", token }),
};

/* ── Brand Profile endpoints ── */
export const brandProfileApi = {
  get: (agencyId: string, clientId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/brand-profile`, { token }),

  upsert: (agencyId: string, clientId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/brand-profile`, { method: "PUT", body: data, token }),
};

/* ── Contract endpoints ── */
export const contractApi = {
  list: (agencyId: string, clientId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/contracts`, { token }),

  create: (agencyId: string, clientId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/contracts`, { method: "POST", body: data, token }),
};

/* ── Campaign endpoints ── */
export const campaignApi = {
  create: (agencyId: string, clientId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/campaigns`, { method: "POST", body: data, token }),

  list: (agencyId: string, clientId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/campaigns`, { token }),

  get: (agencyId: string, campaignId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/campaigns/${campaignId}`, { token }),

  generatePlan: (agencyId: string, clientId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/campaigns/generate-plan`, { method: "POST", body: data, token }),

  chatBrief: (
    agencyId: string,
    clientId: string,
    data: {
      messages: Array<{ role: string; content: string; agent_id?: string; agent_name?: string }>;
      agent_id?: string;
      period_month?: number;
      period_year?: number;
      start_date?: string;
      end_date?: string;
      campaign_id?: string;
      active_artifact_id?: string;
      active_artifact_version?: number;
      pinned_entities?: string[];
      discovered_entities?: string[];
      chat_id?: string;
      session_id?: string;
    },
    token: string
  ) =>
    apiFetch<{
      reply: string;
      agent_id?: string;
      agent_name?: string;
      suggested_objective?: string;
      suggested_custom_brief?: string;
      suggested_deliverable_preferences?: string[];
      suggested_period_month?: number;
      suggested_period_year?: number;
      suggested_start_date?: string;
      suggested_end_date?: string;
      suggested_duration_days?: number;
      is_ready_to_generate: boolean;
      campaign_id?: string;
      session_id?: string;
      chat_id?: string;
      artifact_id?: string;
      artifact_type?: string;
      artifact_title?: string;
      artifact_payload?: Record<string, unknown>;
      artifact_version_number?: number;
      artifact_status?: string;
      supporting_evidence_refs?: Array<Record<string, unknown>>;
      activity_logs?: Array<Record<string, unknown> | string>;
      pinned_entities?: string[];
      discovered_entities?: string[];
    }>(`/agencies/${agencyId}/clients/${clientId}/campaigns/chat-brief`, {
      method: "POST",
      body: data,
      token,
    }),

  chatBriefStream: async (
    agencyId: string,
    clientId: string,
    data: {
      messages: Array<{ role: string; content: string; agent_id?: string; agent_name?: string }>;
      agent_id?: string;
      period_month?: number;
      period_year?: number;
      start_date?: string;
      end_date?: string;
      campaign_id?: string;
      active_artifact_id?: string;
      active_artifact_version?: number;
      pinned_entities?: string[];
      discovered_entities?: string[];
      chat_id?: string;
      session_id?: string;
    },
    token: string,
    onEvent: (event: {
      type: "status" | "turn_start" | "tool_start" | "tool_end" | "token" | "done" | "error";
      message?: string;
      tool?: string;
      status?: string;
      duration_ms?: number;
      summary?: string;
      content?: string;
      response?: any;
      error?: string;
    }) => void
  ) => {
    const res = await fetch(
      `${API_BASE}/agencies/${agencyId}/clients/${clientId}/campaigns/chat-brief/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No readable response stream available");
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        const clean = block.trim();
        if (clean.startsWith("data: ")) {
          try {
            const parsed = JSON.parse(clean.slice(6));
            onEvent(parsed);
          } catch (e) {
            // ignore partial json
          }
        }
      }
    }
  },

  convertToTasks: (agencyId: string, campaignId: string, token: string, dayNumbers?: number[]) =>
    apiFetch<{ campaign_id: string; deliverables_created: number; tasks_created: number; status: string }>(
      `/agencies/${agencyId}/campaigns/${campaignId}/convert-to-tasks`,
      {
        method: "POST",
        body: dayNumbers ? { day_numbers: dayNumbers } : undefined,
        token,
      }
    ),

  syncRunToCampaign: (agencyId: string, clientId: string, runId: string, token: string) =>
    apiFetch<any>(
      `/agencies/${agencyId}/clients/${clientId}/campaigns/sync-run/${runId}`,
      { method: "POST", token }
    ),

  updateDeliverable: (
    agencyId: string,
    clientId: string,
    campaignId: string,
    dayNumber: number,
    data: { deliverable: Record<string, unknown> },
    token: string
  ) =>
    apiFetch<{ success: boolean; deliverable: Record<string, unknown>; campaign_id: string }>(
      `/agencies/${agencyId}/clients/${clientId}/campaigns/${campaignId}/deliverables/${dayNumber}`,
      {
        method: "PUT",
        body: data,
        token,
      }
    ),

  reviseDeliverableAI: (
    agencyId: string,
    clientId: string,
    campaignId: string,
    dayNumber: number,
    data: { instruction: string; current_deliverable: Record<string, unknown> },
    token: string
  ) =>
    apiFetch<{
      revised_deliverable: Record<string, unknown>;
      explanation: string;
      activity_logs?: string[];
    }>(
      `/agencies/${agencyId}/clients/${clientId}/campaigns/${campaignId}/deliverables/${dayNumber}/revise-ai`,
      {
        method: "POST",
        body: data,
        token,
      }
    ),

  delete: (agencyId: string, campaignId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/campaigns/${campaignId}`, { method: "DELETE", token }),
};

/* ── Campaign Studio Artifact & Version endpoints ── */
export const studioApi = {
  listArtifacts: (agencyId: string, campaignId: string, token: string) =>
    apiFetch<Array<any>>(
      `/agencies/${agencyId}/campaigns/${campaignId}/studio/artifacts`,
      { token }
    ),

  getArtifactDetail: (agencyId: string, campaignId: string, artifactId: string, token: string) =>
    apiFetch<any>(
      `/agencies/${agencyId}/campaigns/${campaignId}/studio/artifacts/${artifactId}`,
      { token }
    ),

  approveArtifactVersion: (
    agencyId: string,
    campaignId: string,
    artifactId: string,
    versionNumber: number,
    token: string
  ) =>
    apiFetch<any>(
      `/agencies/${agencyId}/campaigns/${campaignId}/studio/artifacts/${artifactId}/approve`,
      {
        method: "POST",
        body: { version_number: versionNumber },
        token,
      }
    ),

  reviseArtifact: (
    agencyId: string,
    campaignId: string,
    artifactId: string,
    payload: {
      title?: string;
      payload: Record<string, any>;
      change_summary?: string;
      parent_version_id?: string | null;
      supporting_evidence_refs?: Array<Record<string, any>> | null;
    },
    token: string
  ) =>
    apiFetch<any>(
      `/agencies/${agencyId}/campaigns/${campaignId}/studio/artifacts/${artifactId}/revise`,
      {
        method: "POST",
        body: payload,
        token,
      }
    ),

  exportToPipeline: (
    agencyId: string,
    campaignId: string,
    payload: {
      artifact_id: string;
      expected_version_number: number;
      assignee_id?: string | null;
      default_due_date?: string | null;
      target_format?: string | null;
      deliverable_name?: string | null;
      artifact_type?: string | null;
      artifact_payload?: Record<string, any> | null;
    },
    idempotencyKey: string,
    token: string
  ) =>
    apiFetch<any>(
      `/agencies/${agencyId}/campaigns/${campaignId}/studio/export-pipeline`,
      {
        method: "POST",
        headers: {
          "X-Idempotency-Key": idempotencyKey,
        },
        body: payload,
        token,
      }
    ),
};

/* ── Task endpoints ── */
export const taskApi = {
  list: (agencyId: string, token: string, params?: Record<string, string | number | boolean>) => {
    const cleanParams: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) cleanParams[k] = String(v);
      }
    }
    const qs = Object.keys(cleanParams).length > 0 ? "?" + new URLSearchParams(cleanParams).toString() : "";
    return apiFetch<any[]>(`/agencies/${agencyId}/tasks${qs}`, { token });
  },
  get: (agencyId: string, taskId: string, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/tasks/${taskId}`, { token }),
  update: (agencyId: string, taskId: string, data: Record<string, unknown>, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/tasks/${taskId}`, { method: "PATCH", body: data, token }),
  create: (agencyId: string, data: Record<string, unknown>, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/tasks`, { method: "POST", body: data, token }),
  delete: (agencyId: string, taskId: string, token: string) =>
    apiFetch<void>(`/agencies/${agencyId}/tasks/${taskId}`, { method: "DELETE", token }),
  submit: (agencyId: string, taskId: string, formData: FormData, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/tasks/${taskId}/submissions`, { method: "POST", body: formData, token }),
  review: (agencyId: string, taskId: string, data: { decision: "approved" | "changes_requested"; feedback_notes?: string }, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/tasks/${taskId}/review`, { method: "POST", body: data, token }),
  aiAssist: (
    agencyId: string,
    taskId: string,
    data: {
      instruction: string;
      current_hook?: string;
      current_script?: string;
      task_type?: string;
    },
    token: string
  ) =>
    apiFetch<{
      agent_name: string;
      critique: string;
      recommended_hook: string;
      recommended_script: string;
      hook_variations: string[];
    }>(`/agencies/${agencyId}/tasks/${taskId}/ai-assist`, {
      method: "POST",
      body: data,
      token,
    }),
  syncStudio: (
    agencyId: string,
    taskId: string,
    data: {
      hook?: string;
      caption?: string;
      visual_concept?: string;
      cta?: string;
      audio_vibe?: string;
      script_blocks?: any[];
    },
    token: string
  ) =>
    apiFetch<{
      success: boolean;
      campaign_id?: string;
      deliverable_id?: string;
      message: string;
    }>(`/agencies/${agencyId}/tasks/${taskId}/sync-studio`, {
      method: "POST",
      body: data,
      token,
    }),
  listComments: (agencyId: string, taskId: string, token: string) =>
    apiFetch<any[]>(`/agencies/${agencyId}/tasks/${taskId}/comments`, { token }),
  createComment: (
    agencyId: string,
    taskId: string,
    data: { message: string; is_internal?: boolean; content_version_id?: string | null },
    token: string
  ) =>
    apiFetch<any>(`/agencies/${agencyId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: data,
      token,
    }),
};

export interface ScriptBlock {
  id: string;
  scene_number: number;
  title: string;
  spoken_words: string;
  visual_cue?: string | null;
  audio_notes?: string | null;
  duration_seconds?: number | null;
}

export interface TaskChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  stage: "scripting" | "editing" | "qa" | string;
}

/* ── Deliverable & Content Version endpoints ── */
export const deliverableApi = {
  list: (
    agencyId: string,
    token: string,
    params?: {
      client_id?: string;
      campaign_id?: string;
      month?: number;
      year?: number;
      start_date?: string;
      end_date?: string;
      platform?: string;
      status?: string;
    } | string,
    campaignId?: string
  ) => {
    const searchParams = new URLSearchParams();
    if (typeof params === "string") {
      // Backwards compatible with (agencyId, token, clientId, campaignId)
      if (params) searchParams.set("client_id", params);
      if (campaignId) searchParams.set("campaign_id", campaignId);
    } else if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "" && v !== "all") {
          searchParams.set(k, String(v));
        }
      }
    }
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return apiFetch<any[]>(`/agencies/${agencyId}/deliverables${qs}`, { token });
  },
  get: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}`, { token }),

  update: (
    agencyId: string,
    deliverableId: string,
    data: {
      status?: string;
      planned_date?: string | null;
      scheduled_at?: string | null;
      scheduled_timezone?: string | null;
      title?: string;
    },
    token: string
  ) =>
    apiFetch<any>(`/agencies/${agencyId}/deliverables/${deliverableId}`, {
      method: "PATCH",
      body: data,
      token,
    }),

  listVersions: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}/versions`, { token }),

  uploadVersion: (agencyId: string, deliverableId: string, formData: FormData, token: string) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}/versions`, {
      method: "POST",
      body: formData,
      token,
    }),

  updateStatus: (agencyId: string, deliverableId: string, status: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}`, {
      method: "PATCH",
      body: { status },
      token,
    }),

  deleteVersion: (agencyId: string, deliverableId: string, versionId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}/versions/${versionId}`, {
      method: "DELETE",
      token,
    }),

  postComment: (
    agencyId: string,
    deliverableId: string,
    data: { message: string; content_version_id?: string | null; is_internal?: boolean },
    token: string
  ) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}/comments`, {
      method: "POST",
      body: data,
      token,
    }),
};

/* ── Approval endpoints ── */
export const approvalApi = {
  submit: (
    agencyId: string,
    versionId: string,
    data: { decision: "approved" | "changes_requested" | "rejected"; comment?: string },
    token: string
  ) =>
    apiFetch(`/agencies/${agencyId}/content-versions/${versionId}/approve`, {
      method: "POST",
      body: data,
      token,
    }),

  list: (agencyId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/approvals`, { token }),

  queue: (agencyId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/approvals/queue`, { token }),
};

/* ── Client Reviewer endpoints ── */
export const reviewerApi = {
  list: (agencyId: string, clientId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/reviewers`, { token }),

  invite: (agencyId: string, clientId: string, data: { email: string; full_name?: string; password?: string }, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/reviewers`, {
      method: "POST",
      body: data,
      token,
    }),
};

/* ── Client Portal endpoints ── */
export const portalApi = {
  clients: (token: string) =>
    apiFetch(`/portal/clients`, { token }),

  deliverables: (token: string, clientId?: string) => {
    const qs = clientId ? `?client_id=${clientId}` : "";
    return apiFetch(`/portal/deliverables${qs}`, { token });
  },

  deliverable: (deliverableId: string, token: string) =>
    apiFetch(`/portal/deliverables/${deliverableId}`, { token }),

  postComment: (deliverableId: string, message: string, token: string, contentVersionId?: string) =>
    apiFetch(`/portal/deliverables/${deliverableId}/comments`, {
      method: "POST",
      body: { message, content_version_id: contentVersionId ?? null, is_internal: false },
      token,
    }),

  decide: (
    deliverableId: string,
    versionId: string,
    decision: "approved" | "changes_requested",
    comment: string | undefined,
    token: string
  ) =>
    apiFetch(`/portal/deliverables/${deliverableId}/versions/${versionId}/decision`, {
      method: "POST",
      body: { decision, comment: comment || undefined },
      token,
    }),

  batchDecide: (
    deliverableIds: string[],
    decision: "approved" | "changes_requested",
    comment: string | undefined,
    token: string
  ) =>
    apiFetch<{
      total_processed: number;
      approved_count: number;
      scheduled_count: number;
      changes_requested_count: number;
      deliverables: any[];
    }>(`/portal/deliverables/batch-decision`, {
      method: "POST",
      body: { deliverable_ids: deliverableIds, decision, comment: comment || undefined },
      token,
    }),
};

/* ── Social Account endpoints (Phase 5) ── */
export interface SocialAccount {
  id: string;
  client_id: string;
  platform: string;
  account_name: string | null;
  account_handle: string | null;
  instagram_business_id: string | null;
  facebook_page_id: string | null;
  is_active: boolean;
  token_expires_at: string | null;
  created_at: string;
}

export const socialApi = {
  list: (agencyId: string, clientId: string, token: string) =>
    apiFetch<SocialAccount[]>(`/agencies/${agencyId}/clients/${clientId}/social-accounts`, { token }),

  connect: (agencyId: string, clientId: string, data: Record<string, unknown>, token: string) =>
    apiFetch<SocialAccount>(`/agencies/${agencyId}/clients/${clientId}/social-accounts`, {
      method: "POST",
      body: data,
      token,
    }),

  delete: (agencyId: string, clientId: string, accountId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/clients/${clientId}/social-accounts/${accountId}`, {
      method: "DELETE",
      token,
    }),

  verify: (agencyId: string, clientId: string, data: { access_token: string; instagram_business_id: string }, token: string) =>
    apiFetch<{ id: string; username?: string; name?: string; profile_picture_url?: string }>(
      `/agencies/${agencyId}/clients/${clientId}/social-accounts/verify`,
      { method: "POST", body: data, token }
    ),

  exchangeToken: (agencyId: string, clientId: string, data: { app_id: string; app_secret: string; short_lived_token: string }, token: string) =>
    apiFetch<{ access_token: string; token_type: string; expires_in?: number }>(
      `/agencies/${agencyId}/clients/${clientId}/social-accounts/exchange-token`,
      { method: "POST", body: data, token }
    ),

  getOAuthUrl: (agencyId: string, clientId: string, redirectUri: string, token: string) =>
    apiFetch<{ oauth_url: string; client_id: string; redirect_uri: string }>(
      `/agencies/${agencyId}/clients/${clientId}/social-accounts/meta/oauth-url?redirect_uri=${encodeURIComponent(redirectUri)}`,
      { token }
    ),

  resolveCode: (
    agencyId: string,
    clientId: string,
    data: { code: string; redirect_uri: string },
    token: string
  ) =>
    apiFetch<{
      pages: Array<{
        page_id: string;
        page_name: string;
        page_access_token: string;
        instagram_business_account?: {
          id: string;
          username?: string;
          name?: string;
          profile_picture_url?: string;
        };
      }>;
    }>(`/agencies/${agencyId}/clients/${clientId}/social-accounts/meta/resolve-code`, {
      method: "POST",
      body: data,
      token,
    }),

  connectSelected: (
    agencyId: string,
    clientId: string,
    data: {
      page_id: string;
      page_name: string;
      page_access_token: string;
      connect_facebook?: boolean;
      connect_instagram?: boolean;
      instagram_business_id?: string;
      instagram_username?: string;
    },
    token: string
  ) =>
    apiFetch<SocialAccount[]>(
      `/agencies/${agencyId}/clients/${clientId}/social-accounts/meta/connect-selected`,
      {
        method: "POST",
        body: data,
        token,
      }
    ),
};

/* ── Publishing & Delivery endpoints (Phase 5) ── */
export interface PublishResult {
  success: boolean;
  deliverable_id: string;
  status: string;
  live_post_url: string | null;
  external_post_id: string | null;
  published_at: string;
  platform: string;
  message: string;
  platform_results?: Record<string, { success: boolean; post_id?: string; permalink?: string; error?: string }> | null;
}

export interface ScheduledJobOut {
  id: string;
  platform: string;
  status: string;
  scheduled_at: string;
  scheduled_timezone: string;
  next_attempt_at: string;
  attempts_count: number;
  last_error_message?: string | null;
}

export interface ScheduleResponse {
  success: boolean;
  deliverable_id: string;
  status: string;
  scheduled_at: string;
  scheduled_timezone: string;
  jobs: ScheduledJobOut[];
  message: string;
}

export interface ScheduledDeliverableItem {
  deliverable_id: string;
  campaign_id: string;
  client_id: string;
  client_name: string;
  title: string;
  deliverable_type: string;
  platform: string;
  status: string;
  scheduled_at: string;
  scheduled_timezone: string;
  seconds_remaining: number;
  jobs: ScheduledJobOut[];
  thumbnail_url?: string | null;
}

export interface InstagramProfileTelemetry {
  connected: boolean;
  id?: string | null;
  username?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
  followers_count: number;
  follows_count: number;
  media_count: number;
  biography?: string | null;
  website?: string | null;
}

export interface FacebookProfileTelemetry {
  connected: boolean;
  id?: string | null;
  page_name?: string | null;
  fan_count: number;
  followers_count: number;
  talking_about_count: number;
  link?: string | null;
  avatar_url?: string | null;
}

export interface LiveMetaPostItem {
  id: string;
  platform: "instagram" | "facebook" | string;
  caption?: string | null;
  media_type?: string | null;
  media_url?: string | null;
  permalink: string;
  timestamp?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  reach_count?: number;
  views_count?: number;
  saved_count?: number;
  is_deliverable_match: boolean;
  deliverable_title?: string | null;
}

export interface AgencyRoiMetrics {
  monthly_retainer_fee: number;
  currency: string;
  total_audience: number;
  total_social_interactions: number;
  live_engagement_rate: number;
  cost_per_approved_asset: number;
  estimated_production_value: number;
  estimated_earned_media_value: number;
  roi_multiplier: number;
  breakdown_text: string;
}

export interface ContentFormatDistribution {
  videos_count: number;
  images_count: number;
  carousels_count: number;
  other_count: number;
}

export interface EngagementRateMetrics {
  err_rate: number;
  erf_rate: number;
  total_engagements: number;
  total_reach: number;
  total_views?: number;
  total_saves?: number;
  avg_engagements_per_post: number;
  formula_used: string;
  benchmark_status: string;
  is_live_insights_verified?: boolean;
}

export interface MonthlyReport {
  client_id: string;
  client_name: string;
  month: number;
  year: number;
  total_scope_quota: number;
  deliverables_delivered: number;
  deliverables_published: number;
  quota_fulfillment_rate: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  avg_engagement_rate: number;
  top_deliverables: Array<{
    id: string;
    title: string;
    deliverable_type: string;
    platform: string;
    live_post_url: string | null;
    views_count: number;
    likes_count: number;
    comments_count: number;
  }>;
  executive_summary: string;
  instagram_profile?: InstagramProfileTelemetry | null;
  facebook_profile?: FacebookProfileTelemetry | null;
  live_meta_posts?: LiveMetaPostItem[];
  roi_metrics?: AgencyRoiMetrics | null;
  format_distribution?: ContentFormatDistribution | null;
  engagement_rate_metrics?: EngagementRateMetrics | null;
}

export const publishingApi = {
  publish: (
    agencyId: string,
    deliverableId: string,
    data: {
      mode: "automated" | "manual";
      platform?: string;
      live_post_url?: string;
      caption_override?: string;
      media_url_override?: string;
      share_to_feed?: boolean;
    },
    token: string
  ) =>
    apiFetch<PublishResult>(`/agencies/${agencyId}/deliverables/${deliverableId}/publish`, {
      method: "POST",
      body: data,
      token,
    }),

  updateMetrics: (
    agencyId: string,
    deliverableId: string,
    data: {
      views_count?: number;
      likes_count?: number;
      comments_count?: number;
      shares_count?: number;
    },
    token: string
  ) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}/metrics`, {
      method: "PATCH",
      body: data,
      token,
    }),

  syncMetrics: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch<{
      deliverable_id: string;
      views_count: number;
      likes_count: number;
      comments_count: number;
      shares_count: number;
      synced: boolean;
      post_deleted?: boolean;
      message: string;
    }>(`/agencies/${agencyId}/deliverables/${deliverableId}/sync-metrics`, {
      method: "POST",
      token,
    }),

  unpublish: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch<{
      deliverable_id: string;
      status: string;
      unpublish: boolean;
      message: string;
    }>(`/agencies/${agencyId}/deliverables/${deliverableId}/unpublish`, {
      method: "POST",
      token,
    }),

  monthlyReport: (agencyId: string, clientId: string, token: string, month?: number, year?: number) => {
    const params = new URLSearchParams();
    if (month) params.append("month", month.toString());
    if (year) params.append("year", year.toString());
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<MonthlyReport>(`/agencies/${agencyId}/clients/${clientId}/reports/monthly${qs}`, { token });
  },

  schedule: (
    agencyId: string,
    deliverableId: string,
    data: {
      scheduled_at: string;
      scheduled_timezone?: string;
      platform?: string;
      caption_override?: string;
      share_to_feed?: boolean;
    },
    token: string
  ) =>
    apiFetch<ScheduleResponse>(`/agencies/${agencyId}/deliverables/${deliverableId}/schedule`, {
      method: "POST",
      body: data,
      token,
    }),

  reschedule: (
    agencyId: string,
    deliverableId: string,
    data: {
      new_scheduled_at: string;
      scheduled_timezone?: string;
    },
    token: string
  ) =>
    apiFetch<ScheduleResponse>(`/agencies/${agencyId}/deliverables/${deliverableId}/reschedule`, {
      method: "POST",
      body: data,
      token,
    }),

  cancelSchedule: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch<{ success: boolean; status: string; message: string }>(
      `/agencies/${agencyId}/deliverables/${deliverableId}/cancel-schedule`,
      {
        method: "POST",
        token,
      }
    ),

  listScheduled: (agencyId: string, token: string, clientId?: string) => {
    const qs = clientId ? `?client_id=${clientId}` : "";
    return apiFetch<ScheduledDeliverableItem[]>(`/agencies/${agencyId}/scheduled-deliverables${qs}`, {
      token,
    });
  },
};

/* ── Operational Workflows (DAG) endpoints ── */
export interface WorkflowTaskSummary {
  id: string;
  task_key: string;
  title: string;
  task_kind: "system" | "ai" | "human";
  assignee_type: "agent" | "human";
  status: "pending" | "ready" | "in_progress" | "waiting_for_human" | "completed" | "failed" | "blocked" | "cancelled";
  execution_generation: number;
  created_at: string;
  completed_at: string | null;
}

export interface WorkflowRunDetail {
  id: string;
  agency_id: string;
  client_id: string | null;
  campaign_id?: string | null;
  name: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  created_at: string;
  completed_at: string | null;
  tasks: WorkflowTaskSummary[];
  dependencies: { parent: string; child: string }[];
}

export interface StepRunResponse {
  run_id: string;
  completed_tasks_count: number;
  run_status: string;
  waiting_for_human_tasks: string[];
}

export interface TaskOutputDetail {
  task_id: string;
  task_key: string;
  title: string;
  status: string;
  output: Record<string, any> | null;
  version: number | null;
}

export interface TelemetrySummary {
  run_id: string;
  total_cost_usd: string | number;
  total_tokens: number;
  invocations_count: number;
  invocations: Array<{
    id: string;
    provider: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost_usd: string;
    latency_ms: number;
    status: string;
  }>;
}

export const operationalWorkflowApi = {
  listRuns: (agencyId: string, token: string, clientId?: string) => {
    const qs = clientId ? `?client_id=${clientId}` : "";
    return apiFetch<WorkflowRunDetail[]>(`/agencies/${agencyId}/operational-workflows/runs${qs}`, { token });
  },

  getRun: (agencyId: string, runId: string, token: string) =>
    apiFetch<WorkflowRunDetail>(`/agencies/${agencyId}/operational-workflows/runs/${runId}`, { token }),

  launchRun: (
    agencyId: string,
    data: {
      client_id: string;
      campaign_name: string;
      theme: string;
      primary_goal: string;
      target_audience: string | string[];
      platforms?: string[];
      formats?: string[];
      deliverable_count?: number;
      key_offer?: string;
      additional_context?: string;
      brand_id?: string;
      period_month?: number;
      period_year?: number;
      duration_days?: number;
    },
    token: string
  ) =>
    apiFetch<WorkflowRunDetail>(`/agencies/${agencyId}/operational-workflows/runs/launch`, {
      method: "POST",
      body: data,
      token,
    }),

  stepRun: (agencyId: string, runId: string, token: string, maxTicks: number = 10) =>
    apiFetch<StepRunResponse>(`/agencies/${agencyId}/operational-workflows/runs/${runId}/step?max_ticks=${maxTicks}`, {
      method: "POST",
      token,
    }),

  getTaskOutput: (agencyId: string, taskId: string, token: string) =>
    apiFetch<TaskOutputDetail>(`/agencies/${agencyId}/operational-workflows/tasks/${taskId}/output`, { token }),

  reviewTask: (
    agencyId: string,
    taskId: string,
    data: { decision: "approved" | "rejected" | "revision_requested"; feedback_notes?: string },
    token: string
  ) =>
    apiFetch<{ task_id: string; decision: string; unblocked_tasks: string[]; message: string }>(
      `/agencies/${agencyId}/operational-workflows/tasks/${taskId}/review`,
      {
        method: "POST",
        body: data,
        token,
      }
    ),

  getTelemetry: (agencyId: string, runId: string, token: string) =>
    apiFetch<TelemetrySummary>(`/agencies/${agencyId}/operational-workflows/runs/${runId}/telemetry`, { token }),
};

/* ── Community Engagement & Inbox Endpoints ── */
export const engagementApi = {
  listComments: (
    agencyId: string,
    token: string,
    params?: {
      client_id?: string;
      platform?: string;
      sentiment?: string;
      status?: string;
      urgency?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "" && v !== "all") {
          searchParams.set(k, String(v));
        }
      }
    }
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return apiFetch<any[]>(`/agencies/${agencyId}/engagement/comments${qs}`, { token });
  },

  listConversations: (
    agencyId: string,
    token: string,
    params?: {
      client_id?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "" && v !== "all") {
          searchParams.set(k, String(v));
        }
      }
    }
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return apiFetch<any[]>(`/agencies/${agencyId}/engagement/conversations${qs}`, { token });
  },

  sync: (agencyId: string, token: string, clientId?: string) => {
    const qs = clientId && clientId !== "all" ? `?client_id=${clientId}` : "";
    return apiFetch<{ comments_synced: number; conversations_synced: number; status: string; dm_warning?: string | null }>(
      `/agencies/${agencyId}/engagement/sync${qs}`,
      { method: "POST", token }
    );
  },

  replyComment: (agencyId: string, commentId: string, message: string, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/engagement/comments/${commentId}/reply`, {
      method: "POST",
      body: { message },
      token,
    }),

  likeComment: (agencyId: string, commentId: string, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/engagement/comments/${commentId}/like`, {
      method: "POST",
      token,
    }),

  hideComment: (agencyId: string, commentId: string, token: string) =>
    apiFetch<any>(`/agencies/${agencyId}/engagement/comments/${commentId}/hide`, {
      method: "POST",
      token,
    }),

  aiAssist: (agencyId: string, commentId: string, data: { instruction?: string }, token: string) =>
    apiFetch<{
      suggestions: Array<{ tone: string; title: string; reply: string }>;
      sentiment: string;
      intent_category?: string;
      explanation?: string;
    }>(`/agencies/${agencyId}/engagement/comments/${commentId}/ai-assist`, {
      method: "POST",
      body: data,
      token,
    }),

  sendDm: (
    agencyId: string,
    conversationId: string,
    data: { message: string; use_human_agent_tag?: boolean },
    token: string
  ) =>
    apiFetch<any>(`/agencies/${agencyId}/engagement/conversations/${conversationId}/messages`, {
      method: "POST",
      body: data,
      token,
    }),

  stats: (agencyId: string, token: string, clientId?: string) => {
    const qs = clientId && clientId !== "all" ? `?client_id=${clientId}` : "";
    return apiFetch<{
      total_comments: number;
      pending_comments: number;
      replied_comments: number;
      total_conversations: number;
      unread_conversations: number;
      positive_sentiment_percent: number;
      leads_count: number;
      complaints_count: number;
    }>(`/agencies/${agencyId}/engagement/stats${qs}`, { token });
  },

  permissions: (agencyId: string, clientId: string, token: string) =>
    apiFetch<{
      has_manage_comments: boolean;
      has_manage_messages: boolean;
      has_manage_engagement: boolean;
      has_manage_insights: boolean;
      granted_scopes: string[];
      declined_scopes: string[];
    }>(`/agencies/${agencyId}/engagement/permissions?client_id=${clientId}`, { token }),
};

// ── Track 2: Analytics & Historical Benchmarks ──
export interface HistoricalPostItem {
  id: string;
  client_id: string;
  platform: string;
  external_post_id: string;
  media_type: string;
  deliverable_format: string;
  caption?: string | null;
  permalink?: string | null;
  media_url?: string | null;
  published_at?: string | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  reach_count: number;
  impressions_count: number;
  engagement_rate: number;
  is_outlier: boolean;
  outlier_score: number;
  extracted_hook?: string | null;
  hook_archetype?: string | null;
  content_pillar?: string | null;
  created_at: string;
}

export interface FormatBenchmarkItem {
  deliverable_format: string;
  platform: string;
  total_posts: number;
  share_of_volume_pct: number;
  avg_likes: number;
  avg_comments: number;
  avg_shares: number;
  avg_reach: number;
  avg_views: number;
  avg_engagement_rate: number;
  top_hooks: string[];
  is_dominant_format: boolean;
}

export interface WinningOutlierPost {
  id: string;
  platform: string;
  external_post_id: string;
  deliverable_format: string;
  published_at?: string | null;
  media_url?: string | null;
  permalink?: string | null;
  caption_snippet: string;
  extracted_hook: string;
  hook_archetype: string;
  likes: number;
  comments: number;
  reach: number;
  views: number;
  engagement_rate: number;
  outlier_multiplier: number;
}

export interface ClientAnalyticsBenchmarks {
  client_id: string;
  client_name: string;
  data_sufficiency: "cold_start" | "sparse" | "sufficient";
  total_posts_analyzed: number;
  date_range_days: number;
  earliest_post_date?: string | null;
  latest_post_date?: string | null;
  baseline_engagement_rate: number;
  baseline_avg_reach: number;
  baseline_avg_views: number;
  dominant_winning_format: string;
  outlier_multiplier_ceiling: number;
  format_benchmarks: FormatBenchmarkItem[];
  top_winning_outliers: WinningOutlierPost[];
  winning_hooks_and_angles: string[];
  underperforming_patterns: string[];
  recommended_format_mix: Record<string, number>;
  campaign_studio_synced: boolean;
}

export interface BackfillResponse {
  success: boolean;
  client_id: string;
  posts_ingested: number;
  posts_updated: number;
  total_historical_posts: number;
  top_outliers_identified: number;
  dominant_format: string;
  baseline_engagement_rate: number;
  message: string;
}

export const analyticsApi = {
  backfill: (agencyId: string, clientId: string, params?: { limit?: number; days?: number }, token?: string) =>
    apiFetch<BackfillResponse>(`/agencies/${agencyId}/clients/${clientId}/analytics/backfill`, {
      method: "POST",
      body: params || { limit: 100, days: 180 },
      token,
    }),

  getBenchmarks: (agencyId: string, clientId: string, token?: string) =>
    apiFetch<ClientAnalyticsBenchmarks>(`/agencies/${agencyId}/clients/${clientId}/analytics/benchmarks`, {
      token,
    }),

  getHistoricalPosts: (
    agencyId: string,
    clientId: string,
    params?: {
      format?: string;
      platform?: string;
      is_outlier?: boolean;
      sort_by?: string;
      limit?: number;
      offset?: number;
    },
    token?: string
  ) => {
    const q = new URLSearchParams();
    if (params?.format) q.set("format", params.format);
    if (params?.platform) q.set("platform", params.platform);
    if (params?.is_outlier !== undefined) q.set("is_outlier", String(params.is_outlier));
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString() ? `?${q.toString()}` : "";
    return apiFetch<HistoricalPostItem[]>(`/agencies/${agencyId}/clients/${clientId}/analytics/historical-posts${qs}`, {
      token,
    });
  },
};

// ── Track 6: Zero-Login Magic-Link Client Review Room ──
export interface ReviewTokenData {
  token: string;
  review_url: string;
  is_active: boolean;
  views_count: number;
  last_accessed_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface PublicContentVersion {
  id: string;
  version_number: number;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  url: string | null;
  caption: string | null;
  notes: string | null;
  created_at: string;
}

export interface ReviewComment {
  id: string;
  author_name: string;
  author_role: "client" | "agency";
  message: string;
  timestamp_seconds?: number | null;
  content_version_id?: string | null;
  created_at: string;
}

export interface PublicReviewRoom {
  token: string;
  deliverable_id: string;
  title: string;
  deliverable_type: string;
  platform: string;
  status: string;
  planned_date: string | null;
  scheduled_at: string | null;
  live_post_url: string | null;
  client_id: string;
  client_name: string;
  brand_voice: string | null;
  campaign_id: string;
  campaign_name: string;
  script_blocks: ScriptBlock[];
  content_versions: PublicContentVersion[];
  comments: ReviewComment[];
  views_count: number;
  created_at: string;
  is_active: boolean;
}

export const reviewApi = {
  generateToken: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch<ReviewTokenData>(`/agencies/${agencyId}/deliverables/${deliverableId}/review-token`, {
      method: "POST",
      token,
    }),

  revokeToken: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch<void>(`/agencies/${agencyId}/deliverables/${deliverableId}/review-token`, {
      method: "DELETE",
      token,
    }),

  getPublicRoom: (reviewToken: string) =>
    apiFetch<PublicReviewRoom>(`/public/review/${reviewToken}`),

  postComment: (
    reviewToken: string,
    payload: {
      author_name: string;
      message: string;
      content_version_id?: string;
      timestamp_seconds?: number;
    }
  ) =>
    apiFetch<ReviewComment>(`/public/review/${reviewToken}/comments`, {
      method: "POST",
      body: payload,
    }),

  submitDecision: (
    reviewToken: string,
    payload: {
      decision: "approved" | "changes_requested";
      reviewer_name: string;
      feedback_notes?: string;
    }
  ) =>
    apiFetch<PublicReviewRoom>(`/public/review/${reviewToken}/decision`, {
      method: "POST",
      body: payload,
    }),
};

