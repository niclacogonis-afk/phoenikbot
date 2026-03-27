import { Message, GuildMember } from 'discord.js';
import { getGuild } from '../../database/models/Guild';
import { isStaff } from '../permissions/PermissionManager';
import { WarnManager } from '../moderation/WarnManager';

const URL_REGEX = /https?:\/\/[^\s]+/gi;
const SHORT_LINK_DOMAINS = ['bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'goo.gl', 'is.gd', 'buff.ly'];

export class AntiLink {
  static async check(message: Message): Promise<void> {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    if (await isStaff(message.member)) return;

    const guild = await getGuild(message.guild.id);
    if (!guild.antilink.enabled) return;

    const urls = message.content.match(URL_REGEX);
    if (!urls) return;

    for (const url of urls) {
      let hostname = '';
      try {
        hostname = new URL(url).hostname.replace('www.', '');
      } catch {
        continue;
      }

      if (guild.antilink.whitelist.some((w) => hostname === w || hostname.endsWith('.' + w))) continue;

      const isBlacklisted =
        guild.antilink.blacklist.some((b) => hostname === b || hostname.endsWith('.' + b)) ||
        SHORT_LINK_DOMAINS.some((s) => hostname === s);

      if (!isBlacklisted && guild.antilink.blacklist.length === 0) {
        continue;
      }

      if (isBlacklisted || (guild.antilink.blacklist.length > 0 && !guild.antilink.whitelist.some((w) => hostname.endsWith(w)))) {
        await message.delete().catch(() => null);

        if (guild.antilink.action === 'delete_warn' || guild.antilink.action === 'delete_timeout') {
          await WarnManager.addWarn(message.member, `Posted a blocked link: ${hostname}`, message.guild.members.me?.id ?? 'BOT');
        }

        await message.channel.send({
          content: `${message.author}, links from \`${hostname}\` are not allowed here.`,
        }).then((m) => setTimeout(() => m.delete().catch(() => null), 5000));

        break;
      }
    }
  }
}
