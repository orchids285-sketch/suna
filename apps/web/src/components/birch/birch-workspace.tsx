'use client';

/**
 * BirchWorkspace — the ad-automation surface that turns Suna into a Bïrch /
 * Revealbot equivalent. Rendered inside the project shell so it inherits Suna's
 * chrome, fonts (Roobert) and design tokens; built entirely from Suna's own UI
 * primitives so it reads as a native part of the product, not a bolt-on.
 *
 * Data comes from the FoundReach Birch backend at /api/birch/* (same-origin via
 * the wl-suna gateway). Everything is scoped to the signed-in user's workspace.
 */

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Gauge,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Play,
  Plug,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/components/AuthProvider';
import { birch, type AdAccount, type BirchMeta, type Rule, type Strategy } from '@/lib/birch-client';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

// ── formatting ──────────────────────────────────────────────────────────────
const money = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta', google: 'Google', tiktok: 'TikTok', snapchat: 'Snapchat',
};

type SectionId = 'dashboard' | 'rules' | 'strategies' | 'accounts' | 'reports';
const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'rules', label: 'Règles', icon: Zap },
  { id: 'strategies', label: 'Stratégies', icon: Target },
  { id: 'accounts', label: 'Comptes', icon: Wallet },
  { id: 'reports', label: 'Rapports', icon: FileText },
];

const card = 'rounded-2xl border border-border/60 bg-card';
const fieldCls =
  'h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-foreground/30';
const labelCls = 'text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70';

// ============================================================================
// Shell
// ============================================================================
export function BirchWorkspace({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const frUser = user?.id || user?.email || 'shared';
  const [section, setSection] = useState<SectionId>('dashboard');

  const wsQuery = useQuery({
    queryKey: ['birch-workspaces', frUser],
    queryFn: () => birch.workspaces(frUser),
    staleTime: 60_000,
  });
  const workspace = wsQuery.data?.workspaces?.[0];
  const wid = workspace?.id;

  const metaQuery = useQuery({
    queryKey: ['birch-meta'],
    queryFn: () => birch.meta(),
    staleTime: 10 * 60_000,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 px-6 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <Megaphone className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              Automations publicitaires
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {workspace ? workspace.name : 'Chargement…'} · pilotez Meta, Google, TikTok &amp; Snapchat 24/7
            </p>
          </div>
        </div>

        {/* Sub-nav */}
        <div className="mt-4 flex items-center gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'border-foreground font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <s.icon className="size-4" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-5xl">
          {!wid ? (
            <CenteredLoader />
          ) : section === 'dashboard' ? (
            <DashboardSection wid={wid} onGoAccounts={() => setSection('accounts')} />
          ) : section === 'rules' ? (
            <RulesSection wid={wid} frUser={frUser} meta={metaQuery.data} onGoAccounts={() => setSection('accounts')} />
          ) : section === 'strategies' ? (
            <StrategiesSection wid={wid} onGoAccounts={() => setSection('accounts')} />
          ) : section === 'accounts' ? (
            <AccountsSection wid={wid} />
          ) : (
            <ReportsSection wid={wid} />
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredLoader() {
  return (
    <div className="flex h-64 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  desc,
  cta,
  onCta,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className={cn(card, 'flex flex-col items-center justify-center gap-3 px-6 py-16 text-center')}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{desc}</div>
      </div>
      {cta && onCta && (
        <Button size="sm" onClick={onCta} className="mt-1">
          {cta}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Dashboard
// ============================================================================
function DashboardSection({ wid, onGoAccounts }: { wid: string; onGoAccounts: () => void }) {
  const [range, setRange] = useState('last_7_days');
  const q = useQuery({
    queryKey: ['birch-dashboard', wid, range],
    queryFn: () => birch.dashboard(wid, range),
    staleTime: 30_000,
  });
  const d = q.data;
  const t = d?.totals;

  const kpis: { label: string; value: string; icon: LucideIcon; tone?: string }[] = [
    { label: 'Dépense', value: t ? money(t.spend) : '—', icon: Wallet },
    { label: 'Revenu', value: t ? money(t.revenue) : '—', icon: TrendingUp },
    { label: 'ROAS', value: t ? `${t.roas.toFixed(2)}×` : '—', icon: Gauge, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'CPA', value: t ? money(t.cpa) : '—', icon: Target },
    { label: 'Conversions', value: t ? num(t.conversions) : '—', icon: CheckCircle2 },
    { label: 'Clics', value: t ? num(t.clicks) : '—', icon: Activity },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className={labelCls}>Performance globale</h2>
        <select value={range} onChange={(e) => setRange(e.target.value)} className={cn(fieldCls, 'h-8 w-auto cursor-pointer pr-8')}>
          <option value="today">Aujourd&apos;hui</option>
          <option value="yesterday">Hier</option>
          <option value="last_7_days">7 derniers jours</option>
          <option value="last_14_days">14 derniers jours</option>
          <option value="last_30_days">30 derniers jours</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className={cn(card, 'p-4')}>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground/70">
              <k.icon className="size-3.5" />
              {k.label}
            </div>
            <div className={cn('mt-1.5 text-2xl font-semibold tabular-nums tracking-tight', k.tone)}>
              {q.isLoading ? <span className="text-muted-foreground/40">···</span> : k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Connected accounts / state */}
      {d && d.accounts_connected === 0 ? (
        <EmptyState
          icon={Plug}
          title="Aucun compte publicitaire connecté"
          desc="Connectez Meta, Google, TikTok ou Snapchat pour voir vos performances réelles et laisser les règles travailler pour vous."
          cta="Connecter un compte"
          onCta={onGoAccounts}
        />
      ) : (
        d && (
          <div className="flex flex-col gap-2">
            <h2 className={labelCls}>Comptes</h2>
            {d.accounts.map((a: any) => (
              <div key={a.id} className={cn(card, 'flex items-center gap-3 p-3.5')}>
                <Badge variant="secondary" size="sm" className="shrink-0">
                  {PLATFORM_LABEL[a.platform] || a.platform}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{a.name}</span>
                {a.error ? (
                  <span className="text-xs text-destructive">{a.error}</span>
                ) : (
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <span className="text-muted-foreground">{a.campaigns} camp.</span>
                    <span className="font-medium text-foreground">{money(a.spend)}</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{(a.roas ?? 0).toFixed(2)}× ROAS</span>
                  </div>
                )}
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="size-4" />
              {d.rules?.active ?? 0} règle(s) active(s) sur {d.rules?.n ?? 0} · le moteur tourne 24/7
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ============================================================================
// Rules
// ============================================================================
function RulesSection({
  wid,
  frUser,
  meta,
  onGoAccounts,
}: {
  wid: string;
  frUser: string;
  meta?: BirchMeta;
  onGoAccounts: () => void;
}) {
  const qc = useQueryClient();
  const [building, setBuilding] = useState(false);
  const rulesQuery = useQuery({ queryKey: ['birch-rules', wid], queryFn: () => birch.rules(wid) });
  const accountsQuery = useQuery({ queryKey: ['birch-accounts', wid], queryFn: () => birch.adAccounts(wid) });
  const rules = rulesQuery.data?.rules ?? [];
  const accounts = accountsQuery.data?.ad_accounts ?? [];

  const refresh = () => qc.invalidateQueries({ queryKey: ['birch-rules', wid] });

  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  if (building) {
    return (
      <RuleBuilder
        meta={meta}
        accounts={accounts}
        onCancel={() => setBuilding(false)}
        onSave={async (payload) => {
          try {
            await birch.createRule(wid, payload);
            toast.success('Règle créée');
            setBuilding(false);
            refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erreur');
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className={labelCls}>Règles d&apos;automatisation</h2>
        <Button size="sm" onClick={() => setBuilding(true)}>
          <Plus className="size-4" /> Nouvelle règle
        </Button>
      </div>

      {rulesQuery.isLoading ? (
        <CenteredLoader />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Aucune règle pour l'instant"
          desc="Créez une règle SI/ALORS (ex : si le CPA dépasse 30€ sur 7 jours, mettre en pause) ou partez d'une stratégie prête à l'emploi."
          cta="Créer une règle"
          onCta={() => setBuilding(true)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} onAct={act} />
          ))}
        </div>
      )}

      {accounts.length === 0 && rules.length > 0 && (
        <button onClick={onGoAccounts} className="text-left text-xs text-muted-foreground hover:text-foreground">
          ⚠ Aucun compte connecté — les règles ne s&apos;exécuteront qu&apos;une fois un compte lié. Connecter un compte →
        </button>
      )}
    </div>
  );
}

function RuleRow({ rule, onAct }: { rule: Rule; onAct: (fn: () => Promise<any>, ok: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    await onAct(fn, ok);
    setBusy(null);
  };
  const cond = rule.conditions?.[0];
  return (
    <div className={cn(card, 'flex flex-wrap items-center gap-3 p-3.5')}>
      <Switch
        checked={rule.is_active}
        onCheckedChange={() => run('toggle', () => birch.toggleRule(rule.id), rule.is_active ? 'Règle mise en pause' : 'Règle activée')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{rule.name}</span>
          <Badge variant="outline" size="sm" className="shrink-0">
            {PLATFORM_LABEL[rule.acc_platform || rule.platform] || rule.platform}
          </Badge>
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {rule.account_name || 'compte non lié'} · {rule.entity_level}
          {cond ? ` · si ${cond.metric} ${cond.operator} ${cond.value}` : ''} · {scheduleLabel(rule.schedule)}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconBtn title="Exécuter maintenant" busy={busy === 'run'} onClick={() => run('run', () => birch.runRule(rule.id), 'Exécutée')}>
          <Play className="size-3.5" />
        </IconBtn>
        <IconBtn title="Aperçu (dry-run)" busy={busy === 'prev'} onClick={() => run('prev', () => birch.previewRule(rule.id), 'Aperçu calculé')}>
          <Eye className="size-3.5" />
        </IconBtn>
        <IconBtn title="Dupliquer" busy={busy === 'dup'} onClick={() => run('dup', () => birch.duplicateRule(rule.id), 'Dupliquée')}>
          <Copy className="size-3.5" />
        </IconBtn>
        <IconBtn title="Supprimer" danger busy={busy === 'del'} onClick={() => run('del', () => birch.deleteRule(rule.id), 'Supprimée')}>
          <Trash2 className="size-3.5" />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={busy}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50',
        danger && 'hover:text-destructive',
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : children}
    </button>
  );
}

function scheduleLabel(s?: { type: string; value: string }) {
  if (!s) return '';
  if (s.type === 'daily') return `chaque jour ${s.value}`;
  const map: Record<string, string> = { '15min': 'toutes les 15 min', '30min': 'toutes les 30 min', '1h': 'toutes les heures', '1d': 'une fois/jour' };
  return map[s.value] || s.value;
}

// ── Rule builder (IF / THEN) ────────────────────────────────────────────────
function RuleBuilder({
  meta,
  accounts,
  onSave,
  onCancel,
}: {
  meta?: BirchMeta;
  accounts: AdAccount[];
  onSave: (payload: any) => void;
  onCancel: () => void;
}) {
  const metrics = meta?.metrics ?? [{ value: 'cpa', label: 'CPA' }, { value: 'roas', label: 'ROAS' }, { value: 'spend', label: 'Dépense' }];
  const windows = meta?.windows ?? [{ value: 'last_7_days', label: '7 derniers jours' }];
  const actions = meta?.actions ?? [{ value: 'pause', label: 'Mettre en pause' }];
  const operators = meta?.operators ?? ['>', '<', '>=', '<=', '=', '!='];

  const [name, setName] = useState('');
  const [adAccountId, setAdAccountId] = useState(accounts[0]?.id || '');
  const [entityLevel, setEntityLevel] = useState('adset');
  const [logic, setLogic] = useState('AND');
  const [conditions, setConditions] = useState<any[]>([
    { metric: 'cpa', operator: '>', value: '', window: 'last_7_days', group: 0 },
  ]);
  const [ruleActions, setRuleActions] = useState<any[]>([{ type: 'pause', value: '', value_type: 'percentage' }]);
  const [schedule, setSchedule] = useState({ type: 'interval', value: '1h' });

  const upC = (i: number, patch: any) => setConditions(conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const upA = (i: number, patch: any) => setRuleActions(ruleActions.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const isBudget = (t: string) => /budget|bid/.test(t);
  const platform = accounts.find((a) => a.id === adAccountId)?.platform || 'meta';

  const save = () =>
    onSave({
      name: name || 'Règle sans nom',
      platform,
      ad_account_id: adAccountId,
      entity_level: entityLevel,
      condition_logic: logic,
      conditions: conditions.map((c) => ({ ...c, value: parseFloat(c.value) || c.value })),
      actions: ruleActions,
      schedule,
      is_active: false,
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className={labelCls}>Nouvelle règle</h2>
        <button onClick={onCancel} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className={cn(card, 'flex flex-col gap-5 p-5')}>
        <div>
          <label className={labelCls}>Nom de la règle</label>
          <input className={cn(fieldCls, 'mt-1.5')} placeholder="Ex : Pause CPA élevé" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Compte publicitaire</label>
            <select className={cn(fieldCls, 'mt-1.5 cursor-pointer')} value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)}>
              {accounts.length === 0 && <option value="">— Connectez un compte —</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_name || a.account_id} ({PLATFORM_LABEL[a.platform] || a.platform})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Appliquer sur</label>
            <div className="mt-1.5 flex gap-1.5">
              {[['campaign', 'Campagne'], ['adset', 'Ad set'], ['ad', 'Annonce']].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setEntityLevel(v)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-2 text-sm transition-colors',
                    entityLevel === v ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* IF */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className={labelCls}>SI ces conditions sont remplies</label>
            <div className="flex gap-1">
              {['AND', 'OR'].map((l) => (
                <button
                  key={l}
                  onClick={() => setLogic(l)}
                  className={cn('rounded-md px-2.5 py-1 text-xs transition-colors', logic === l ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground')}
                >
                  {l === 'AND' ? 'ET' : 'OU'}
                </button>
              ))}
            </div>
          </div>
          {conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background p-2.5">
              <select className={cn(fieldCls, 'w-36')} value={c.metric} onChange={(e) => upC(i, { metric: e.target.value })}>
                {metrics.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select className={cn(fieldCls, 'w-16')} value={c.operator} onChange={(e) => upC(i, { operator: e.target.value })}>
                {operators.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <input className={cn(fieldCls, 'w-24')} placeholder="valeur" value={c.value} onChange={(e) => upC(i, { value: e.target.value })} />
              <select className={cn(fieldCls, 'min-w-36 flex-1')} value={c.window} onChange={(e) => upC(i, { window: e.target.value })}>
                {windows.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              {conditions.length > 1 && (
                <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setConditions([...conditions, { metric: 'roas', operator: '<', value: '', window: 'last_7_days', group: 0 }])}
            className="self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            + Ajouter une condition
          </button>
        </div>

        {/* THEN */}
        <div className="flex flex-col gap-2">
          <label className={labelCls}>ALORS exécuter</label>
          {ruleActions.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background p-2.5">
              <select className={cn(fieldCls, 'min-w-44 flex-1')} value={a.type} onChange={(e) => upA(i, { type: e.target.value })}>
                {actions.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
              </select>
              {isBudget(a.type) && (
                <>
                  <input className={cn(fieldCls, 'w-24')} placeholder="valeur" value={a.value} onChange={(e) => upA(i, { value: e.target.value })} />
                  <select className={cn(fieldCls, 'w-28')} value={a.value_type} onChange={(e) => upA(i, { value_type: e.target.value })}>
                    <option value="percentage">%</option>
                    <option value="absolute">€ fixe</option>
                  </select>
                </>
              )}
              {ruleActions.length > 1 && (
                <button onClick={() => setRuleActions(ruleActions.filter((_, j) => j !== i))} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => setRuleActions([...ruleActions, { type: 'alert', value: '', value_type: 'percentage' }])}
            className="self-start rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            + Ajouter une action
          </button>
        </div>

        {/* Schedule */}
        <div>
          <label className={labelCls}>Fréquence d&apos;exécution</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[['15min', 'Toutes les 15 min'], ['30min', 'Toutes les 30 min'], ['1h', 'Toutes les heures'], ['1d', 'Une fois/jour']].map(([v, l]) => {
              const on = schedule.value === v || (v === '1d' && schedule.type === 'daily');
              return (
                <button
                  key={v}
                  onClick={() => setSchedule({ type: v === '1d' ? 'daily' : 'interval', value: v === '1d' ? '09:00' : v })}
                  className={cn('rounded-lg border px-3 py-2 text-sm transition-colors', on ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        <Button size="sm" onClick={save} disabled={!adAccountId}>Enregistrer la règle</Button>
      </div>
    </div>
  );
}

// ============================================================================
// Strategies
// ============================================================================
const CATEGORY_TONE: Record<string, string> = {
  ROAS: 'text-emerald-600 dark:text-emerald-400',
  CPA: 'text-blue-600 dark:text-blue-400',
  Scaling: 'text-purple-600 dark:text-purple-400',
  Dayparting: 'text-amber-600 dark:text-amber-400',
  Fatigue: 'text-rose-600 dark:text-rose-400',
};

function StrategiesSection({ wid, onGoAccounts }: { wid: string; onGoAccounts: () => void }) {
  const stratsQuery = useQuery({ queryKey: ['birch-strategies'], queryFn: () => birch.strategies() });
  const accountsQuery = useQuery({ queryKey: ['birch-accounts', wid], queryFn: () => birch.adAccounts(wid) });
  const strategies = stratsQuery.data?.strategies ?? [];
  const accounts = accountsQuery.data?.ad_accounts ?? [];
  const [account, setAccount] = useState('');
  const [applying, setApplying] = useState<string | null>(null);

  const effectiveAccount = account || accounts[0]?.id || '';

  const grouped = useMemo(() => {
    const g: Record<string, Strategy[]> = {};
    for (const s of strategies) (g[s.category || 'Autres'] ||= []).push(s);
    return g;
  }, [strategies]);

  const apply = async (s: Strategy) => {
    if (!effectiveAccount) {
      onGoAccounts();
      return;
    }
    setApplying(s.id);
    try {
      await birch.applyStrategy(s.id, { workspace_id: wid, ad_account_id: effectiveAccount });
      toast.success(`« ${s.name} » créée en pause — activez-la dans Règles`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
    setApplying(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className={labelCls}>Stratégies prêtes à l&apos;emploi</h2>
        {accounts.length > 0 && (
          <select value={effectiveAccount} onChange={(e) => setAccount(e.target.value)} className={cn(fieldCls, 'h-8 w-auto cursor-pointer')}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.account_name || a.account_id}</option>
            ))}
          </select>
        )}
      </div>

      {stratsQuery.isLoading ? (
        <CenteredLoader />
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="flex flex-col gap-2">
            <div className={cn('text-xs font-semibold uppercase tracking-wider', CATEGORY_TONE[cat] || 'text-muted-foreground')}>{cat}</div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {items.map((s) => (
                <div key={s.id} className={cn(card, 'flex flex-col gap-2 p-4')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">{s.name}</div>
                    {s.platform && <Badge variant="outline" size="sm" className="shrink-0">{PLATFORM_LABEL[s.platform] || s.platform}</Badge>}
                  </div>
                  {s.description && <div className="text-xs leading-relaxed text-muted-foreground">{s.description}</div>}
                  <Button size="sm" variant="outline" className="mt-1 self-start" disabled={applying === s.id} onClick={() => apply(s)}>
                    {applying === s.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Appliquer
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================================
// Accounts
// ============================================================================
const PLATFORMS = [
  { value: 'meta', label: 'Meta (Facebook / Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'snapchat', label: 'Snapchat Ads' },
];

function AccountsSection({ wid }: { wid: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['birch-accounts', wid], queryFn: () => birch.adAccounts(wid) });
  const accounts = q.data?.ad_accounts ?? [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ platform: 'meta', account_id: '', account_name: '', access_token: '' });
  const [saving, setSaving] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['birch-accounts', wid] });

  const connect = async () => {
    if (!form.account_id || !form.access_token) {
      toast.error('Renseignez l’ID du compte et le token');
      return;
    }
    setSaving(true);
    try {
      await birch.connectAccount(wid, form);
      toast.success('Compte connecté');
      setOpen(false);
      setForm({ platform: 'meta', account_id: '', account_name: '', access_token: '' });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
    setSaving(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className={labelCls}>Comptes publicitaires</h2>
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Connecter
          </Button>
        )}
      </div>

      {open && (
        <div className={cn(card, 'flex flex-col gap-4 p-5')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Plateforme</label>
              <select className={cn(fieldCls, 'mt-1.5 cursor-pointer')} value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nom (optionnel)</label>
              <input className={cn(fieldCls, 'mt-1.5')} placeholder="Mon compte Meta" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>ID du compte</label>
              <input className={cn(fieldCls, 'mt-1.5')} placeholder="act_123456789" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Access token</label>
              <input className={cn(fieldCls, 'mt-1.5')} type="password" placeholder="••••••••" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={connect} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Connecter le compte
            </Button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <CenteredLoader />
      ) : accounts.length === 0 && !open ? (
        <EmptyState
          icon={Wallet}
          title="Aucun compte connecté"
          desc="Liez un compte Meta, Google, TikTok ou Snapchat pour que les règles et le dashboard travaillent sur vos vraies campagnes."
          cta="Connecter un compte"
          onCta={() => setOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((a) => (
            <div key={a.id} className={cn(card, 'flex items-center gap-3 p-3.5')}>
              <Badge variant="secondary" size="sm" className="shrink-0">{PLATFORM_LABEL[a.platform] || a.platform}</Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{a.account_name || a.account_id}</div>
                <div className="truncate text-xs text-muted-foreground">{a.account_id}</div>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500" /> {a.status || 'active'}
              </span>
              <button
                title="Déconnecter"
                onClick={async () => {
                  try {
                    await birch.disconnectAccount(a.id);
                    toast.success('Déconnecté');
                    refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Erreur');
                  }
                }}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Reports
// ============================================================================
function ReportsSection({ wid }: { wid: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['birch-reports', wid], queryFn: () => birch.reports(wid) });
  const reports: any[] = (q.data as any)?.reports ?? [];
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await birch.createReport(wid, {
        name,
        metrics: ['spend', 'revenue', 'roas', 'cpa', 'conversions'],
        date_range: 'last_7_days',
        schedule_type: 'weekly',
        delivery_method: ['email'],
      });
      toast.success('Rapport créé');
      setName('');
      qc.invalidateQueries({ queryKey: ['birch-reports', wid] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
    setCreating(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className={labelCls}>Rapports automatiques</h2>
      <div className={cn(card, 'flex flex-wrap items-end gap-3 p-4')}>
        <div className="min-w-48 flex-1">
          <label className={labelCls}>Nom du rapport</label>
          <input className={cn(fieldCls, 'mt-1.5')} placeholder="Rapport hebdo performance" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button size="sm" onClick={create} disabled={creating || !name.trim()}>
          {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Créer
        </Button>
      </div>

      {q.isLoading ? (
        <CenteredLoader />
      ) : reports.length === 0 ? (
        <EmptyState icon={FileText} title="Aucun rapport" desc="Créez un rapport récurrent (dépense, ROAS, CPA…) livré par email automatiquement." />
      ) : (
        <div className="flex flex-col gap-2">
          {reports.map((r) => (
            <div key={r.id} className={cn(card, 'flex items-center gap-3 p-3.5')}>
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.date_range} · {r.schedule_type || 'manuel'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default BirchWorkspace;
