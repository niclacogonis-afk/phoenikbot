import { ButtonBuilder, ButtonStyle } from 'discord.js';

export interface TicketButtonConfig {
  label: string;
  emoji: string;
  type: string;
  style: number;
}

const DEFAULT_BUTTONS: TicketButtonConfig[] = [
  { label: 'Support', emoji: '🎫', type: 'support', style: ButtonStyle.Primary },
  { label: 'Report', emoji: '🚨', type: 'report', style: ButtonStyle.Danger },
  { label: 'Purchase', emoji: '🛒', type: 'purchase', style: ButtonStyle.Success },
];

const SLUG = /^[a-z0-9][a-z0-9_-]{0,39}$/i;

/** Esportato per uso con documenti Mongoose / oggetti già parsati */
export function normalizeTicketButtons(raw: unknown): TicketButtonConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_BUTTONS];
  const out: TicketButtonConfig[] = [];
  for (const item of raw.slice(0, 25)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? '').trim().slice(0, 80);
    const emoji = String(o.emoji ?? '').trim().slice(0, 80);
    const type = String(o.type ?? 'support').trim().slice(0, 40).toLowerCase();
    let style = Number(o.style);
    if (!Number.isFinite(style) || style < 1 || style > 4) style = ButtonStyle.Primary;
    if (!label) continue;
    if (!SLUG.test(type)) continue;
    out.push({ label, emoji, type, style });
  }
  return out.length ? out : [...DEFAULT_BUTTONS];
}

export function parseTicketButtonsJson(body: string | undefined): TicketButtonConfig[] {
  if (!body || typeof body !== 'string') return [...DEFAULT_BUTTONS];
  try {
    const parsed = JSON.parse(body) as unknown;
    return normalizeTicketButtons(parsed);
  } catch {
    return [...DEFAULT_BUTTONS];
  }
}

export function buildTicketOpenButtons(configs: TicketButtonConfig[]): ButtonBuilder[] {
  return configs.map((b) => {
    const btn = new ButtonBuilder()
      .setCustomId(`ticket:open:${b.type}`)
      .setLabel(b.label)
      .setStyle(b.style as ButtonStyle);
    const em = b.emoji?.trim();
    if (em) btn.setEmoji(em);
    return btn;
  });
}
