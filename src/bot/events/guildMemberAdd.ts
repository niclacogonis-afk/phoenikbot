import { GuildMember, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../types';
import { isModuleEnabled } from '../../modules/cache/CacheManager';
import { incrementDailyStat } from '../../database/models/Stats';
import { sendLog } from '../../modules/logging/LogManager';
import { GlobalBanModel } from '../../database/models/GlobalBan';
import { getUser } from '../../database/models/User';

const event: BotEvent = {
  name: 'guildMemberAdd',
  async execute(member: GuildMember) {
    const guildId = member.guild.id;

    if (await isModuleEnabled(guildId, 'stats')) {
      await incrementDailyStat(guildId, 'joins').catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'antirAid')) {
      const { RaidDetector } = await import('../../modules/antirAid/RaidDetector');
      await RaidDetector.onMemberJoin(member).catch(() => null);
    }

    if (await isModuleEnabled(guildId, 'logging')) {
      const accountAge = Date.now() - member.user.createdTimestamp;
      const days = Math.floor(accountAge / (1000 * 60 * 60 * 24));
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('👋 Member Joined')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'User', value: `${member.user} (${member.user.username})`, inline: true },
          { name: 'ID', value: member.user.id, inline: true },
          { name: 'Account Age', value: `${days} days`, inline: true },
          { name: 'Members', value: `${member.guild.memberCount}`, inline: true }
        )
        .setTimestamp();
      await sendLog(member.guild, embed);
    }

    const globalBan = await GlobalBanModel.findOne({ discordId: member.user.id });
    if (globalBan) {
      await member.ban({ reason: `Global ban: ${globalBan.reason}` }).catch(() => null);
      return;
    }

    const user = await getUser(guildId, member.user.id);
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountDays = accountAge / (1000 * 60 * 60 * 24);

    if (accountDays < 7) {
      user.riskFlags = [...new Set([...user.riskFlags, 'new-account'])];
      user.riskScore = Math.min(100, user.riskScore + 20);
    }
    if (!member.user.avatar) {
      user.riskFlags = [...new Set([...user.riskFlags, 'no-avatar'])];
      user.riskScore = Math.min(100, user.riskScore + 10);
    }
    await user.save();
  },
};

export default event;
