import { Message, GuildMember } from 'discord.js';
import { config } from '../../config';
import { isStaff } from '../permissions/PermissionManager';
import { WarnManager } from '../moderation/WarnManager';
import { getUser } from '../../database/models/User';
import { sendLog, modEmbed } from '../logging/LogManager';
import { logger } from '../../utils/logger';
import { BannedWordModel } from '../../database/models/BannedWord';
import { isModuleEnabled } from '../cache/CacheManager';

const ROBLOX_SCAM_KEYWORDS = [
  'free robux', 'free roblox', 'claim robux', 'get robux', 'earn robux',
  'roblox giveaway', 'robuxcode', 'rbxfree',
];

const messageHistory = new Map<string, { content: string; count: number; lastTime: number }>();

// Cache for banned words per guild (refresh every 5 minutes)
const bannedWordsCache = new Map<string, { words: Array<{ word: string; severity: string; language: string; action: string }>; cachedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class AIModeration {
  static async analyze(message: Message): Promise<void> {
    if (!message.guild || !message.content || !(message.member instanceof GuildMember)) return;
    if (await isStaff(message.member)) return;
    if (!(await isModuleEnabled(message.guild.id, 'ai'))) return;

    // Run all checks in parallel
    await Promise.all([
      AIModeration.checkBannedWords(message),
      AIModeration.checkRobloxScam(message),
      AIModeration.checkFlood(message),
      config.openaiKey ? AIModeration.checkWithAI(message).catch(() => null) : Promise.resolve(),
    ]);
  }

  /**
   * Check message against banned words in all languages
   */
  static async checkBannedWords(message: Message): Promise<void> {
    if (!message.guild || !(message.member instanceof GuildMember)) return;

    const guildId = message.guild.id;
    const content = message.content.toLowerCase();
    
    // Get cached words or fetch from DB
    let cached = bannedWordsCache.get(guildId);
    if (!cached || Date.now() - cached.cachedAt > CACHE_TTL) {
      const words = await BannedWordModel.find({ guildId, enabled: true });
      cached = {
        words: words.map(w => ({
          word: w.word.toLowerCase(),
          severity: w.severity,
          language: w.language,
          action: w.action,
        })),
        cachedAt: Date.now(),
      };
      bannedWordsCache.set(guildId, cached);
    }

    for (const bw of cached.words) {
      // Check if word matches (supports 'all' languages or specific language detection)
      if (bw.language !== 'all') {
        // For now, we'll check if the message contains the banned word
        // A real implementation would use language detection
        if (!content.includes(bw.word)) continue;
      } else {
        if (!content.includes(bw.word)) continue;
      }

      // Word found! Take action based on severity
      await message.delete().catch(() => null);

      const embed = modEmbed('🚨 Banned Word Detected', [
        { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Word', value: `||${bw.word}||`, inline: true },
        { name: 'Severity', value: bw.severity.toUpperCase(), inline: true },
        { name: 'Content', value: message.content.slice(0, 500) },
      ], 0xED4245);
      await sendLog(message.guild, embed);

      // Take action based on severity
      switch (bw.action) {
        case 'ban':
          await message.member.ban({ reason: `AI: Banned word "${bw.word}" detected` }).catch(() => null);
          break;
        case 'kick':
          await message.member.kick(`AI: Banned word "${bw.word}" detected`).catch(() => null);
          break;
        case 'mute':
          await message.member.timeout(3600000, `AI: Banned word "${bw.word}" detected`).catch(() => null);
          break;
        case 'warn':
        default:
          await WarnManager.addWarn(
            message.member,
            `AI: Banned word "${bw.word}" detected (Severity: ${bw.severity})`,
            message.guild.members.me?.id ?? 'BOT'
          );
          break;
      }

      // Update user risk score
      const severityScores: Record<string, number> = {
        low: 10,
        medium: 20,
        high: 30,
        critical: 50,
      };
      const user = await getUser(guildId, message.author.id);
      user.riskScore = Math.min(100, user.riskScore + (severityScores[bw.severity] || 20));
      user.riskFlags = [...new Set([...user.riskFlags, 'banned-word'])];
      await user.save();

      // Only trigger once per message
      return;
    }
  }

  static async checkRobloxScam(message: Message): Promise<void> {
    const content = message.content.toLowerCase();
    const isScam = ROBLOX_SCAM_KEYWORDS.some((kw) => content.includes(kw));

    if (isScam && message.guild && message.member instanceof GuildMember) {
      await message.delete().catch(() => null);

      const embed = modEmbed('🚨 Roblox Scam Detected', [
        { name: 'User', value: `${message.author.username} (${message.author.id})`, inline: true },
        { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
        { name: 'Content', value: message.content.slice(0, 500) },
      ], 0xED4245);
      await sendLog(message.guild, embed);

      await WarnManager.addWarn(message.member, 'AI: Roblox scam content detected', message.guild.members.me?.id ?? 'BOT');

      const user = await getUser(message.guild.id, message.author.id);
      user.riskScore = Math.min(100, user.riskScore + 30);
      user.riskFlags = [...new Set([...user.riskFlags, 'scam'])];
      await user.save();
    }
  }

  static async checkFlood(message: Message): Promise<void> {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const existing = messageHistory.get(key);

    if (existing && existing.content === message.content && now - existing.lastTime < 10000) {
      existing.count++;
      existing.lastTime = now;
      if (existing.count >= 3) {
        await message.member.timeout(60000, 'AI: Message flooding detected').catch(() => null);
        messageHistory.delete(key);
      }
    } else {
      messageHistory.set(key, { content: message.content, count: 1, lastTime: now });
    }
  }

  static async checkWithAI(message: Message): Promise<void> {
    if (!config.openaiKey || !message.guild || !(message.member instanceof GuildMember)) return;

    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: config.openaiKey });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a Discord moderation assistant. Analyze the following message and respond with a JSON object: {"classification": "safe|suspicious|spam|scam|offensive", "reason": "brief reason"}. Be concise.',
          },
          { role: 'user', content: message.content },
        ],
        max_tokens: 100,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message.content ?? '{"classification":"safe"}') as { classification: string; reason?: string };

      if (result.classification === 'scam' || result.classification === 'offensive') {
        await message.delete().catch(() => null);
        const user = await getUser(message.guild.id, message.author.id);
        user.riskScore = Math.min(100, user.riskScore + 20);
        user.riskFlags = [...new Set([...user.riskFlags, 'ai-scam', 'ai-offensive'])];
        await user.save();
      } else if (result.classification === 'spam') {
        const user = await getUser(message.guild.id, message.author.id);
        user.riskScore = Math.min(100, user.riskScore + 10);
        await user.save();
      }
    } catch (err) {
      logger.debug('AI moderation error (likely no credits):', String(err));
    }
  }

  /**
   * Clear cache for a guild (call when words are updated)
   */
  static clearCache(guildId: string): void {
    bannedWordsCache.delete(guildId);
  }
}
