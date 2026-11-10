/**
 * AgencyOS API client
 * Base URL points to FastAPI backend
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
};

async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;

  const headers: Record<string, string> = {};
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
    throw new Error(error.detail ?? `HTTP ${res.status}`);
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
    }>(`/agencies/${agencyId}/clients/${clientId}/campaigns/chat-brief`, {
      method: "POST",
      body: data,
      token,
    }),

  convertToTasks: (agencyId: string, campaignId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/campaigns/${campaignId}/convert-to-tasks`, { method: "POST", token }),

  delete: (agencyId: string, campaignId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/campaigns/${campaignId}`, { method: "DELETE", token }),
};

/* ── Task endpoints ── */
export const taskApi = {
  list: (agencyId: string, token: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return apiFetch(`/agencies/${agencyId}/tasks${qs}`, { token });
  },
  update: (agencyId: string, taskId: string, data: Record<string, unknown>, token: string) =>
    apiFetch(`/agencies/${agencyId}/tasks/${taskId}`, { method: "PATCH", body: data, token }),
};

/* ── Deliverable & Content Version endpoints ── */
export const deliverableApi = {
  get: (agencyId: string, deliverableId: string, token: string) =>
    apiFetch(`/agencies/${agencyId}/deliverables/${deliverableId}`, { token }),

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
