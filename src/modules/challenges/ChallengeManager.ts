import { GuildMember, Message } from 'discord.js';
import { ChallengeModel, UserQuestModel, IChallenge } from '../../database/models/Challenge';
import { getUserWallet } from '../../database/models/Economy';

export class ChallengeManager {

  static async getActiveChallenges(guildId: string): Promise<IChallenge[]> {
    return ChallengeModel.find({
      guildId,
      active: true,
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: new Date() } },
      ],
    }).sort({ createdAt: -1 });
  }

  static async createChallenge(
    guildId: string,
    name: string,
    description: string,
    type: IChallenge['type'],
    target: number,
    reward: number,
    expiresAt: Date | null = null
  ): Promise<IChallenge> {
    return ChallengeModel.create({ guildId, name, description, type, target, reward, active: true, expiresAt });
  }

  static async deleteChallenge(challengeId: string): Promise<boolean> {
    const result = await ChallengeModel.deleteOne({ _id: challengeId });
    return result.deletedCount > 0;
  }

  static async onMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const challenges = await this.getActiveChallenges(message.guild.id);
    const msgChallenges = challenges.filter(c => c.type === 'messages');

    for (const challenge of msgChallenges) {
      let quest = await UserQuestModel.findOne({
        guildId: message.guild.id,
        userId: message.author.id,
        challengeId: (challenge as any)._id.toString(),
      });

      if (!quest) {
        quest = await UserQuestModel.create({
          guildId: message.guild.id,
          userId: message.author.id,
          challengeId: (challenge as any)._id.toString(),
          progress: 0,
          completed: false,
        });
      }

      if (quest.completed) continue;

      quest.progress += 1;

      if (quest.progress >= challenge.target) {
        quest.completed = true;
        quest.completedAt = new Date();
      }

      await quest.save();
    }
  }

  static async getUserChallenges(guildId: string, userId: string) {
    const challenges = await this.getActiveChallenges(guildId);
    const quests = await UserQuestModel.find({ guildId, userId });
    const questMap = new Map(quests.map(q => [q.challengeId, q]));

    return challenges.map(challenge => {
      const quest = questMap.get((challenge as any)._id.toString());
      return {
        challenge,
        progress: quest?.progress || 0,
        completed: quest?.completed || false,
        claimed: quest?.claimedAt != null,
      };
    });
  }

  static async claimReward(guildId: string, userId: string, challengeId: string): Promise<{ success: boolean; message: string; reward: number }> {
    const challenge = await ChallengeModel.findById(challengeId);
    if (!challenge || !challenge.active) return { success: false, message: 'Challenge not found or inactive.', reward: 0 };

    const quest = await UserQuestModel.findOne({ guildId, userId, challengeId });
    if (!quest || !quest.completed) return { success: false, message: 'Challenge not completed yet.', reward: 0 };
    if (quest.claimedAt) return { success: false, message: 'Reward already claimed.', reward: 0 };

    quest.claimedAt = new Date();
    await quest.save();

    const wallet = await getUserWallet(guildId, userId);
    wallet.balance += challenge.reward;
    wallet.totalEarned += challenge.reward;
    await wallet.save();

    return { success: true, message: `Claimed **${challenge.reward}** coins for completing "${challenge.name}"!`, reward: challenge.reward };
  }
}
