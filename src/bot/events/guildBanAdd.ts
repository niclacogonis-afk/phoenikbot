import { Guild, User, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../../modules/cache/CacheManager';
import { sendLog } from '../../modules/logging/LogManager';
import { incrementDailyStat } from '../../database/models/Stats';

const event: BotEvent = {
  name: 'guildBanAdd',
  async execute(ban: { guild: Guild; user: User }) {
    const guildId = ban.guild.id;

    if (await isModuleEnabled(guildId, 'stats')) {
      await incrementDailyStat(guildId, 'bans').catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'antinuke')) {
      const { AntiNuke } = await import('../../modules/antirAid/AntiNuke');
      await AntiNuke.onBan(ban.guild, ban.user).catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'logging')) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 Member Banned')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
          { name: 'User', value: `${ban.user.username}`, inline: true },
          { name: 'ID', value: ban.user.id, inline: true }
        )
        .setTimestamp();
      await sendLog(ban.guild, embed, 'modlog');
    }
  },
};

export default event;
