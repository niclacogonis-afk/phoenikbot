import { CachedGuild, GuildModules } from '../../types';
import { getGuild } from '../../database/models/Guild';

const cache = new Map<string, CachedGuild>();
const TTL = 5 * 60 * 1000;

export async function getCachedGuild(guildId: string): Promise<CachedGuild> {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.cachedAt < TTL) return cached;

  const guild = await getGuild(guildId);
  const data: CachedGuild = {
    modules: guild.modules as GuildModules,
    logChannel: guild.logChannel,
    modLogChannel: guild.modLogChannel,
    staffRoles: guild.staffRoles,
    adminRoles: guild.adminRoles,
    cachedAt: Date.now(),
  };
  cache.set(guildId, data);
  return data;
}

export function invalidateGuildCache(guildId: string): void {
  cache.delete(guildId);
}

export async function isModuleEnabled(guildId: string, module: keyof GuildModules): Promise<boolean> {
  const guild = await getCachedGuild(guildId);
  return guild.modules[module] ?? false;
}
