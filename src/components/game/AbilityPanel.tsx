import clsx from 'clsx';
import { Clock, Crosshair, Eye, ShieldPlus, Zap } from 'lucide-react';
import type { AbilityType, RoomSettings, Team, TeamAbility } from '../../game/types';
import { ABILITIES, ABILITY_ORDER, TEAM_COLORS } from '../../game/constants';

export const ABILITY_ICONS: Record<AbilityType, React.ReactNode> = {
  shield_boost: <ShieldPlus className="h-5 w-5" />,
  double_attack: <Crosshair className="h-5 w-5" />,
  time_freeze: <Clock className="h-5 w-5" />,
  energy_steal: <Zap className="h-5 w-5" />,
  hint_scan: <Eye className="h-5 w-5" />,
};

export interface AbilityAvailability {
  ok: boolean;
  reason: string | null;
}

export function abilityAvailability(
  ability: AbilityType,
  team: Team,
  ab: TeamAbility | undefined,
  settings: RoomSettings,
  ctx: { questionActive: boolean; serverNow: number },
): AbilityAvailability {
  const cost = settings.ability_costs?.[ability] ?? 30;
  if (settings.disabled_abilities?.includes(ability)) return { ok: false, reason: 'Oʻchirilgan' };
  if (!ab || !ab.is_enabled) return { ok: false, reason: 'Mavjud emas' };
  if (ab.uses_left <= 0) return { ok: false, reason: 'Limit tugagan' };
  if (ab.cooldown_until && Date.parse(ab.cooldown_until) > ctx.serverNow) return { ok: false, reason: 'Zaryadlanmoqda' };
  if (team.energy < cost) return { ok: false, reason: `${cost} energiya kerak` };
  if ((ability === 'time_freeze' || ability === 'hint_scan') && !ctx.questionActive) return { ok: false, reason: 'Faol savol kerak' };
  if (ability === 'shield_boost' && team.shield_boost_active) return { ok: false, reason: 'Allaqachon faol' };
  if (ability === 'double_attack' && team.double_attack_active) return { ok: false, reason: 'Allaqachon faol' };
  return { ok: true, reason: null };
}

/** Qobiliyatlar paneli: oʻqituvchi ishlatadi yoki oʻquvchi soʻraydi */
export function AbilityPanel({
  team,
  abilities,
  settings,
  questionActive,
  serverNow,
  onUse,
  actionLabel = 'Faollashtirish',
  busy,
  compact,
  requested,
}: {
  team: Team;
  abilities: TeamAbility[];
  settings: RoomSettings;
  questionActive: boolean;
  serverNow: number;
  onUse?: (a: AbilityType) => void;
  actionLabel?: string;
  busy?: boolean;
  compact?: boolean;
  requested?: Set<AbilityType>;
}) {
  const color = TEAM_COLORS[team.color].hex;
  return (
    <div className={clsx('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-1')}>
      {ABILITY_ORDER.map((key) => {
        const meta = ABILITIES[key];
        const ab = abilities.find((a) => a.team_id === team.id && a.ability_type === key);
        const avail = abilityAvailability(key, team, ab, settings, { questionActive, serverNow });
        const isRequested = requested?.has(key);
        return (
          <div
            key={key}
            className={clsx('flex items-center gap-3 rounded-xl border bg-space-950/50 p-2.5', avail.ok ? 'border-white/10' : 'border-white/5 opacity-70')}
          >
            <div className="rounded-lg p-2" style={{ background: `${meta.color}1f`, color: meta.color }}>
              {ABILITY_ICONS[key]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold tracking-wider">{meta.title}</span>
                <span className="text-[0.65rem] text-arena-muted">×{ab?.uses_left ?? 0}</span>
              </div>
              <div className="truncate text-xs text-arena-muted" title={meta.description}>
                {avail.reason ?? `${meta.short} • ${settings.ability_costs?.[key] ?? 30} energiya`}
              </div>
            </div>
            {onUse && (
              <button
                type="button"
                className="btn btn-sm btn-ghost shrink-0"
                style={avail.ok ? { borderColor: `${color}88` } : undefined}
                disabled={!avail.ok || busy || isRequested}
                onClick={() => onUse(key)}
              >
                {isRequested ? 'Soʻralgan' : actionLabel}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
