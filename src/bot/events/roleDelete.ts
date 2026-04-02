import { Role } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../../modules/cache/CacheManager';

const event: BotEvent = {
  name: 'roleDelete',
  async execute(role: Role) {
    if (!role.guild) return;
    if (await isModuleEnabled(role.guild.id, 'antinuke')) {
      const { AntiNuke } = await import('../../modules/antirAid/AntiNuke');
      await AntiNuke.onRoleDelete(role).catch(() => null);
    }
  },
};

export default event;
