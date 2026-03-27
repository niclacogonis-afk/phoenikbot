import axios from 'axios';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { TwitchConfigModel } from '../../database/models/TwitchConfig';
import { config } from '../../config';
import { logger } from '../../utils/logger';

let twitchToken: string | null = null;
let twitchTokenExpires = 0;

async function getTwitchToken(): Promise<string | null> {
  if (!config.twitchClientId || !config.twitchClientSecret) return null;
  if (twitchToken && Date.now() < twitchTokenExpires) return twitchToken;

  try {
    const res = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: config.twitchClientId,
        client_secret: config.twitchClientSecret,
        grant_type: 'client_credentials',
      },
    });
    twitchToken = res.data.access_token;
    twitchTokenExpires = Date.now() + (res.data.expires_in - 300) * 1000;
    return twitchToken;
  } catch {
    return null;
  }
}

export class TwitchNotifier {
  static async checkAll(client: Client): Promise<void> {
    const token = await getTwitchToken();
    if (!token) return;

    const configs = await TwitchConfigModel.find({});

    for (const cfg of configs) {
      try {
        const guild = client.guilds.cache.get(cfg.guildId);
        if (!guild) continue;

        const res = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${cfg.streamerName}`, {
          headers: {
            'Client-ID': config.twitchClientId,
            'Authorization': `Bearer ${token}`,
          },
        });

        const stream = res.data?.data?.[0];
        const isLive = !!stream;

        if (isLive && !cfg.isLive) {
          cfg.isLive = true;
          await cfg.save();

          if (cfg.filterGames.length > 0 && !cfg.filterGames.includes(stream.game_name)) continue;

          const channel = guild.channels.cache.get(cfg.discordChannelId) as TextChannel | undefined;
          if (!channel) continue;

          const thumbnail = stream.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720') ?? '';
          const embed = new EmbedBuilder()
            .setColor(0x9146FF)
            .setTitle(`🟣 ${cfg.streamerName} is LIVE!`)
            .setURL(`https://twitch.tv/${cfg.streamerName}`)
            .setDescription(`**${stream.title}**\nPlaying: **${stream.game_name}**`)
            .setImage(thumbnail)
            .setTimestamp();

          const content = cfg.pingRoleId ? `<@&${cfg.pingRoleId}>` : undefined;
          const msg = await channel.send({ content, embeds: [embed] });
          cfg.lastMessageId = msg.id;
          await cfg.save();
        } else if (!isLive && cfg.isLive) {
          cfg.isLive = false;
          await cfg.save();

          if (cfg.autoDeleteWhenOffline && cfg.lastMessageId) {
            const channel = guild.channels.cache.get(cfg.discordChannelId) as TextChannel | undefined;
            if (channel) {
              await channel.messages.delete(cfg.lastMessageId).catch(() => null);
            }
            cfg.lastMessageId = null;
            await cfg.save();
          }
        }
      } catch (err) {
        logger.debug(`Twitch check error for ${cfg.streamerName}:`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
