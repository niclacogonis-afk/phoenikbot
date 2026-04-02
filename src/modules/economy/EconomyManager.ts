import { Message, GuildMember, TextChannel, Role, Guild } from 'discord.js';
import { 
  getEconomyConfig, 
  getUserWallet, 
  UserWalletModel,
  ShopItemModel,
  TransactionModel,
  IUserWallet,
  IShopItem 
} from '../../database/models/Economy';
import { logger } from '../../utils/logger';

/**
 * Economy System Manager
 * Handles currency, rewards, gambling, and shop
 */
export class EconomyManager {
  /**
   * Award daily reward to a user
   */
  static async claimDaily(member: GuildMember): Promise<{ success: boolean; amount: number; message: string; streak: number }> {
    const config = await getEconomyConfig(member.guild.id);
    const wallet = await getUserWallet(member.guild.id, member.id);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // Check if daily is on cooldown
    if (now - wallet.lastDaily < oneDay) {
      const remaining = oneDay - (now - wallet.lastDaily);
      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      return { 
        success: false, 
        amount: 0, 
        message: `Daily reward on cooldown! Wait ${hours}h ${minutes}m.`,
        streak: wallet.streak 
      };
    }

    // Check streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - oneDay).toISOString().split('T')[0];
    
    let streakBonus = 0;
    let newStreak = wallet.streak;
    
    if (wallet.lastDailyStreak === yesterday) {
      newStreak = wallet.streak + 1;
      streakBonus = Math.floor(config.dailyReward * 0.1 * newStreak); // 10% bonus per streak
    } else if (wallet.lastDailyStreak !== today) {
      newStreak = 1;
    }

    const totalReward = config.dailyReward + streakBonus;
    
    wallet.balance += totalReward;
    wallet.lastDaily = now;
    wallet.totalEarned += totalReward;
    wallet.streak = newStreak;
    wallet.lastDailyStreak = today;
    await wallet.save();

    // Log transaction
    await TransactionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      type: 'daily',
      amount: totalReward,
      balance: wallet.balance,
      description: `Daily reward (streak: ${newStreak})`,
    });

    return { 
      success: true, 
      amount: totalReward, 
      message: `You claimed ${config.currencySymbol}${totalReward}!${streakBonus > 0 ? ` (+${config.currencySymbol}${streakBonus} streak bonus!)` : ''}`,
      streak: newStreak 
    };
  }

  /**
   * Claim hourly reward
   */
  static async claimHourly(member: GuildMember): Promise<{ success: boolean; amount: number; message: string }> {
    const config = await getEconomyConfig(member.guild.id);
    const wallet = await getUserWallet(member.guild.id, member.id);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    if (now - wallet.lastHourly < oneHour) {
      const remaining = oneHour - (now - wallet.lastHourly);
      const minutes = Math.floor(remaining / (60 * 1000));
      return { 
        success: false, 
        amount: 0, 
        message: `Hourly reward on cooldown! Wait ${minutes} minutes.` 
      };
    }

    wallet.balance += config.hourlyReward;
    wallet.lastHourly = now;
    wallet.totalEarned += config.hourlyReward;
    await wallet.save();

    await TransactionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      type: 'hourly',
      amount: config.hourlyReward,
      balance: wallet.balance,
      description: 'Hourly reward',
    });

    return { 
      success: true, 
      amount: config.hourlyReward, 
      message: `You claimed ${config.currencySymbol}${config.hourlyReward}!` 
    };
  }

  /**
   * Award message reward
   */
  static async onMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;

    const config = await getEconomyConfig(message.guild.id);
    if (config.messageReward <= 0) return;

    const wallet = await getUserWallet(message.guild.id, message.author.id);
    
    // Random chance (1 in 5 messages)
    if (Math.random() > 0.2) return;

    wallet.balance += config.messageReward;
    wallet.totalEarned += config.messageReward;
    await wallet.save();

    await TransactionModel.create({
      guildId: message.guild.id,
      userId: message.author.id,
      type: 'message',
      amount: config.messageReward,
      balance: wallet.balance,
      description: 'Message reward',
    });
  }

  /**
   * Get user's balance
   */
  static async getBalance(guildId: string, userId: string): Promise<{ balance: number; symbol: string; name: string }> {
    const config = await getEconomyConfig(guildId);
    const wallet = await getUserWallet(guildId, userId);
    return { 
      balance: wallet.balance, 
      symbol: config.currencySymbol, 
      name: config.currencyName 
    };
  }

  /**
   * Transfer money to another user
   */
  static async transfer(
    sender: GuildMember, 
    recipientId: string, 
    amount: number
  ): Promise<{ success: boolean; message: string }> {
    const config = await getEconomyConfig(sender.guild.id);
    const senderWallet = await getUserWallet(sender.guild.id, sender.id);

    if (amount <= 0) {
      return { success: false, message: 'Amount must be positive.' };
    }

    if (senderWallet.balance < amount) {
      return { success: false, message: `Insufficient funds. You have ${config.currencySymbol}${senderWallet.balance}.` };
    }

    // Check recipient exists
    const recipient = await sender.guild.members.fetch(recipientId).catch(() => null);
    if (!recipient) {
      return { success: false, message: 'User not found in this server.' };
    }

    if (recipientId === sender.id) {
      return { success: false, message: 'You cannot transfer to yourself.' };
    }

    const recipientWallet = await getUserWallet(sender.guild.id, recipientId);

    senderWallet.balance -= amount;
    senderWallet.totalSpent += amount;
    await senderWallet.save();

    recipientWallet.balance += amount;
    recipientWallet.totalEarned += amount;
    await recipientWallet.save();

    await TransactionModel.create({
      guildId: sender.guild.id,
      userId: sender.id,
      type: 'transfer_out',
      amount: -amount,
      balance: senderWallet.balance,
      description: `Transfer to ${recipient.user.username}`,
    });

    await TransactionModel.create({
      guildId: sender.guild.id,
      userId: recipientId,
      type: 'transfer_in',
      amount: amount,
      balance: recipientWallet.balance,
      description: `Transfer from ${sender.user.username}`,
    });

    return { 
      success: true, 
      message: `You transferred ${config.currencySymbol}${amount} to ${recipient.user.username}!` 
    };
  }

  /**
   * Gamble money
   */
  static async gamble(
    member: GuildMember, 
    amount: number
  ): Promise<{ success: boolean; won: boolean; amount: number; newBalance: number; message: string }> {
    const config = await getEconomyConfig(member.guild.id);
    
    if (!config.gambleEnabled) {
      return { success: false, won: false, amount: 0, newBalance: 0, message: 'Gambling is disabled on this server.' };
    }

    if (amount < config.minGambleAmount) {
      return { success: false, won: false, amount: 0, newBalance: 0, message: `Minimum gamble amount is ${config.currencySymbol}${config.minGambleAmount}.` };
    }

    const wallet = await getUserWallet(member.guild.id, member.id);

    if (wallet.balance < amount) {
      return { success: false, won: false, amount: 0, newBalance: wallet.balance, message: `Insufficient funds. You have ${config.currencySymbol}${wallet.balance}.` };
    }

    if (wallet.balance < config.minGambleAmount) {
      return { success: false, won: false, amount: 0, newBalance: wallet.balance, message: `You need at least ${config.currencySymbol}${config.minGambleAmount} to gamble.` };
    }

    // 50% chance to win
    const won = Math.random() >= 0.5;
    const multiplier = won ? 2 : 0; // Simple 2x win
    const netAmount = won ? amount : -amount;

    wallet.balance += netAmount;
    wallet.totalGambled += amount;
    
    if (won) {
      wallet.totalWon += amount;
    } else {
      wallet.totalLost += amount;
      wallet.totalSpent += amount;
    }
    
    await wallet.save();

    await TransactionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      type: won ? 'gamble_win' : 'gamble_lose',
      amount: netAmount,
      balance: wallet.balance,
      description: won ? `Won ${config.currencySymbol}${amount} gambling` : `Lost ${config.currencySymbol}${amount} gambling`,
    });

    return { 
      success: true, 
      won, 
      amount: netAmount, 
      newBalance: wallet.balance,
      message: won 
        ? `🎉 You won ${config.currencySymbol}${amount}! (2x multiplier)`
        : `💸 You lost ${config.currencySymbol}${amount}. Better luck next time!`
    };
  }

  /**
   * Buy an item from the shop
   */
  static async buyItem(member: GuildMember, itemId: string): Promise<{ success: boolean; message: string }> {
    const item = await ShopItemModel.findOne({ _id: itemId, guildId: member.guild.id });
    
    if (!item) {
      return { success: false, message: 'Item not found.' };
    }

    // Check stock
    if (item.stock === 0) {
      return { success: false, message: 'This item is out of stock.' };
    }

    // Check required role
    if (item.requiredRoleId && !member.roles.cache.has(item.requiredRoleId)) {
      return { success: false, message: 'You need a specific role to purchase this item.' };
    }

    const wallet = await getUserWallet(member.guild.id, member.id);
    const config = await getEconomyConfig(member.guild.id);

    if (wallet.balance < item.price) {
      return { success: false, message: `Insufficient funds. You have ${config.currencySymbol}${wallet.balance}, need ${config.currencySymbol}${item.price}.` };
    }

    // Check if user already has this role
    if (member.roles.cache.has(item.roleId)) {
      return { success: false, message: 'You already have this role!' };
    }

    // Purchase
    wallet.balance -= item.price;
    wallet.totalSpent += item.price;
    await wallet.save();

    await member.roles.add(item.roleId).catch(() => {});

    // Decrease stock
    if (item.stock > 0) {
      item.stock -= 1;
      await item.save();
    }

    await TransactionModel.create({
      guildId: member.guild.id,
      userId: member.id,
      type: 'shop',
      amount: -item.price,
      balance: wallet.balance,
      description: `Purchased ${item.name}`,
    });

    return { 
      success: true, 
      message: `You purchased **${item.name}** for ${config.currencySymbol}${item.price}!` 
    };
  }

  /**
   * Get shop items for a guild
   */
  static async getShopItems(guildId: string): Promise<IShopItem[]> {
    return ShopItemModel.find({ guildId }).sort({ price: 1 });
  }

  /**
   * Add item to shop
   */
  static async addShopItem(
    guild: Guild,
    roleId: string,
    name: string,
    price: number,
    description: string = '',
    stock: number = -1,
    requiredRoleId: string | null = null
  ): Promise<IShopItem> {
    const role = guild.roles.cache.get(roleId);
    if (!role) throw new Error('Role not found');

    return ShopItemModel.create({
      guildId: guild.id,
      roleId,
      name: name || role.name,
      description,
      price,
      stock,
      requiredRoleId,
    });
  }

  /**
   * Get richest users in a server
   */
  static async getRichList(guildId: string, limit: number = 10): Promise<any[]> {
    const wallets = await UserWalletModel.find({ guildId })
      .sort({ balance: -1 })
      .limit(limit);
    
    return wallets.map((w, i) => ({
      rank: i + 1,
      userId: w.userId,
      balance: w.balance,
      totalEarned: w.totalEarned,
    }));
  }
}
