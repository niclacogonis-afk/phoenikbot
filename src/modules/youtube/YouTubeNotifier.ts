import axios from 'axios';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { YouTubeConfigModel } from '../../database/models/YouTubeConfig';
import { logger } from '../../utils/logger';

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  'yt:videoId': string;
  'yt:channelId': string;
  'media:group'?: {
    'media:thumbnail'?: [{ $?: { url?: string } }];
    'media:description'?: string[];
  };
}

export class YouTubeNotifier {
  static async checkAll(client: Client): Promise<void> {
    const configs = await YouTubeConfigModel.find({});

    for (const config of configs) {
      try {
        const guild = client.guilds.cache.get(config.guildId);
        if (!guild) continue;

        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${config.youtubeChannelId}`;
        const response = await axios.get(feedUrl, { timeout: 10000 });

        const { parseString } = await import('xml2js');
        const parsed = await new Promise<any>((resolve, reject) => {
          parseString(response.data, (err: Error | null, result: any) => {
            if (err) reject(err);
            else resolve(result);
          });
        });

        const entries = parsed?.feed?.entry ?? [];
        if (!entries.length) continue;

        const latest = entries[0] as any;
        const videoId = latest['yt:videoId']?.[0] ?? '';
        const title = latest.title?.[0] ?? '';
        const link = latest.link?.[0]?.['$']?.href ?? `https://youtube.com/watch?v=${videoId}`;
        const thumbnail = latest['media:group']?.[0]?.['media:thumbnail']?.[0]?.['$']?.url ?? '';

        if (config.filterShorts && (title.toLowerCase().includes('#shorts') || title.toLowerCase().includes('short'))) continue;

        if (videoId === config.lastVideoId) continue;

        config.lastVideoId = videoId;
        config.lastCheckedAt = new Date();
        await config.save();

        const channel = guild.channels.cache.get(config.discordChannelId) as TextChannel | undefined;
        if (!channel) continue;

        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle(`🔴 New Video: ${title}`)
          .setURL(link)
          .setDescription(`**${config.youtubeChannelName}** just uploaded a new video!`)
          .setImage(thumbnail || null)
          .setTimestamp();

        const content = config.pingRoleId ? `<@&${config.pingRoleId}> ${config.customMessage ?? ''}` : config.customMessage ?? undefined;
        await channel.send({ content, embeds: [embed] });

        logger.info(`YouTube: Sent notification for ${config.youtubeChannelName}`);
      } catch (err) {
        logger.debug(`YouTube check error for ${config.youtubeChannelId}:`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
