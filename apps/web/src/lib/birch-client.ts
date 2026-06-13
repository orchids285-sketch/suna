// Birch — the ad-automation surface (Bïrch / Revealbot equivalent) that lives
// natively inside Suna. Talks to the FoundReach Birch backend at /api/birch/*,
// proxied SAME-ORIGIN through the wl-suna gateway, so there's no CORS and no
// bearer header to manage. Per-user isolation rides on ?fr_user (the Supabase
// user id), exactly like every other FoundReach tool.

const BASE = '/api/birch';

export interface VocabItem {
  value: string;
  label: string;
}
export interface BirchMeta {
  metrics: VocabItem[];
  windows: VocabItem[];
  actions: VocabItem[];
  operators: string[];
  platforms: string[];
  entity_levels: string[];
}
export interface Workspace {
  id: string;
  name: string;
  color?: string;
  rules?: number;
  accounts?: number;
}
export interface AdAccount {
  id: string;
  platform: string;
  account_id: string;
  account_name?: string | null;
  status?: string;
}
export interface Condition {
  metric: string;
  operator: string;
  value: number | string;
  window: string;
  group?: number;
}
export interface RuleAction {
  type: string;
  value?: number | string;
  value_type?: string;
}
export interface Rule {
  id: string;
  name: string;
  platform: string;
  ad_account_id: string;
  account_name?: string | null;
  acc_platform?: string | null;
  entity_level: string;
  conditions: Condition[];
  condition_logic: string;
  actions: RuleAction[];
  schedule: { type: string; value: string };
  is_active: boolean;
  last_log?: string | null;
}
export interface Strategy {
  id: string;
  name: string;
  category?: string;
  platform?: string | null;
  description?: string;
  rule_template?: any;
}
export interface DashboardTotals {
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
}
export interface DashboardData {
  ok: boolean;
  date_range: string;
  totals: DashboardTotals;
  accounts: any[];
  rules: { n?: number; active?: number };
  accounts_connected: number;
}

async function call<T = any>(
  path: string,
  opts: { method?: string; body?: any; frUser?: string } = {},
): Promise<T> {
  const { method = 'GET', body, frUser } = opts;
  const sep = path.includes('?') ? '&' : '?';
  const url = frUser
    ? `${BASE}${path}${sep}fr_user=${encodeURIComponent(frUser)}`
    : `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`Birch ${res.status}: ${detail.slice(0, 160)}`);
  }
  return res.json();
}

export const birch = {
  meta: () => call<BirchMeta>('/meta'),
  health: () => call('/health'),

  workspaces: (frUser: string) =>
    call<{ ok: boolean; workspaces: Workspace[] }>('/workspaces', { frUser }),

  dashboard: (wid: string, range = 'last_7_days') =>
    call<DashboardData>(`/workspaces/${wid}/dashboard?date_range=${range}`),

  adAccounts: (wid: string) =>
    call<{ ok: boolean; ad_accounts: AdAccount[] }>(`/workspaces/${wid}/ad-accounts`),
  connectAccount: (wid: string, body: any) =>
    call(`/workspaces/${wid}/ad-accounts`, { method: 'POST', body }),
  disconnectAccount: (id: string) => call(`/ad-accounts/${id}`, { method: 'DELETE' }),

  rules: (wid: string) => call<{ ok: boolean; rules: Rule[] }>(`/workspaces/${wid}/rules`),
  createRule: (wid: string, body: any) =>
    call(`/workspaces/${wid}/rules`, { method: 'POST', body }),
  toggleRule: (id: string) => call(`/rules/${id}/toggle`, { method: 'POST' }),
  runRule: (id: string) => call(`/rules/${id}/run-now`, { method: 'POST' }),
  previewRule: (id: string) => call(`/rules/${id}/preview`, { method: 'POST' }),
  deleteRule: (id: string) => call(`/rules/${id}`, { method: 'DELETE' }),
  duplicateRule: (id: string) => call(`/rules/${id}/duplicate`, { method: 'POST' }),

  strategies: () => call<{ ok: boolean; strategies: Strategy[] }>('/strategies'),
  applyStrategy: (id: string, body: any) =>
    call(`/strategies/${id}/apply`, { method: 'POST', body }),

  reports: (wid: string) => call(`/workspaces/${wid}/reports`),
  createReport: (wid: string, body: any) =>
    call(`/workspaces/${wid}/reports`, { method: 'POST', body }),
};
