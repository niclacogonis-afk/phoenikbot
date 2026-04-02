import { AuditLogModel } from '../../database/models/AuditLog';
import { logger } from '../../utils/logger';

export async function writeAudit(opts: {
  guildId: string;
  action: string;
  actorId?: string | null;
  targetId?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await AuditLogModel.create({
      guildId: opts.guildId,
      action: opts.action.slice(0, 120),
      actorId: opts.actorId ?? null,
      targetId: opts.targetId ?? null,
      detail: opts.detail ? opts.detail.slice(0, 2000) : null,
    });
  } catch (e) {
    logger.debug('writeAudit failed:', e instanceof Error ? e : new Error(String(e)));
  }
}
