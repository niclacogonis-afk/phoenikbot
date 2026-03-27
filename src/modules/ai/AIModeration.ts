import { Message, GuildMember } from 'discord.js';
import { config } from '../../config';
import { isStaff } from '../permissions/PermissionManager';
import { WarnManager } from '../moderation/WarnManager';
import { getUser } from '../../database/models/User';
import { sendLog, modEmbed } from '../logging/LogManager';
import { logger } from '../../utils/logger';

const ROBLOX_SCAM_KEYWORDS = [
  'free robux', 'free roblox', 'claim robux', 'get robux', 'earn robux',
  'roblox giveaway', 'robuxcode', 'rbxfree',
];

const messageHistory = new Map<string, { content: string; count: number; lastTime: number }>();

export class AIModeration {
  static async analyze(message: Message): Promise<void> {
    if (!message.guild || !message.content || !(message.member instanceof GuildMember)) return;
    if (await isStaff(message.member)) return;

    await AIModeration.checkRobloxScam(message);
    await AIModeration.checkFlood(message);

    if (config.openaiKey) {
      await AIModeration.checkWithAI(message).catch(() => null);
    }
  }

  static async checkRobloxScam(message: Message): Promise<void> {
    const content = message.content.toLowerCase();
    const isScam = ROBLOX_SCAM_KEYWORDS.some((kw) => content.includes(kw));

    if (isScam && message.guild && message.member instanceof GuildMember) {
      await message.delete().catch(() => null);

      const embed = modEmbed('🚨 Roblox Scam Detected', [
        { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
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
            content: 'You are a Discord moderation assistant. Analyze the following message and respond with a JSON object: {"classification": "safe|suspicious|spam|scam", "reason": "brief reason"}. Be concise.',
          },
          { role: 'user', content: message.content },
        ],
        max_tokens: 100,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0]?.message.content ?? '{"classification":"safe"}') as { classification: string; reason?: string };

      if (result.classification === 'scam') {
        await message.delete().catch(() => null);
        const user = await getUser(message.guild.id, message.author.id);
        user.riskScore = Math.min(100, user.riskScore + 20);
        user.riskFlags = [...new Set([...user.riskFlags, 'ai-scam'])];
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
}
