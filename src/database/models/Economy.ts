import mongoose, { Document, Schema } from 'mongoose';

export interface IEconomyConfig extends Document {
  guildId: string;
  currencyName: string;
  currencySymbol: string;
  startingBalance: number;
  dailyReward: number;
  hourlyReward: number;
  messageReward: number;
  gambleEnabled: boolean;
  minGambleAmount: number;
  maxGambleAmount: number;
}

const EconomyConfigSchema = new Schema<IEconomyConfig>({
  guildId: { type: String, required: true, unique: true, index: true },
  currencyName: { type: String, default: 'coins' },
  currencySymbol: { type: String, default: '💰' },
  startingBalance: { type: Number, default: 100 },
  dailyReward: { type: Number, default: 500 },
  hourlyReward: { type: Number, default: 50 },
  messageReward: { type: Number, default: 1 },
  gambleEnabled: { type: Boolean, default: true },
  minGambleAmount: { type: Number, default: 10 },
  maxGambleAmount: { type: Number, default: 10000 },
}, { timestamps: true });

export const EconomyConfigModel = mongoose.model<IEconomyConfig>('EconomyConfig', EconomyConfigSchema);

export interface IUserWallet extends Document {
  guildId: string;
  userId: string;
  balance: number;
  lastDaily: number;
  lastHourly: number;
  totalEarned: number;
  totalSpent: number;
  totalGambled: number;
  totalWon: number;
  totalLost: number;
  streak: number;
  lastDailyStreak: string; // YYYY-MM-DD format
}

const UserWalletSchema = new Schema<IUserWallet>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  balance: { type: Number, default: 0 },
  lastDaily: { type: Number, default: 0 },
  lastHourly: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  totalGambled: { type: Number, default: 0 },
  totalWon: { type: Number, default: 0 },
  totalLost: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastDailyStreak: { type: String, default: '' },
}, { timestamps: true });

UserWalletSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserWalletSchema.index({ guildId: 1, balance: -1 });

export const UserWalletModel = mongoose.model<IUserWallet>('UserWallet', UserWalletSchema);

export async function getEconomyConfig(guildId: string): Promise<IEconomyConfig> {
  let config = await EconomyConfigModel.findOne({ guildId });
  if (!config) {
    config = await EconomyConfigModel.create({ guildId });
  }
  return config;
}

export async function getUserWallet(guildId: string, userId: string): Promise<IUserWallet> {
  let wallet = await UserWalletModel.findOne({ guildId, userId });
  if (!wallet) {
    const config = await getEconomyConfig(guildId);
    wallet = await UserWalletModel.create({ 
      guildId, 
      userId, 
      balance: config.startingBalance 
    });
  }
  return wallet;
}

/**
 * Shop items that users can purchase
 */
export interface IShopItem extends Document {
  guildId: string;
  roleId: string;
  name: string;
  description: string;
  price: number;
  stock: number; // -1 for unlimited
  requiredRoleId: string | null; // Role required to purchase
}

const ShopItemSchema = new Schema<IShopItem>({
  guildId: { type: String, required: true, index: true },
  roleId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  stock: { type: Number, default: -1 }, // -1 = unlimited
  requiredRoleId: { type: String, default: null },
});

ShopItemSchema.index({ guildId: 1, roleId: 1 }, { unique: true });

export const ShopItemModel = mongoose.model<IShopItem>('ShopItem', ShopItemSchema);

/**
 * Transaction history
 */
export interface ITransaction extends Document {
  guildId: string;
  userId: string;
  type: 'daily' | 'hourly' | 'message' | 'gamble_win' | 'gamble_lose' | 'shop' | 'transfer_in' | 'transfer_out' | 'pay' | 'bonus';
  amount: number;
  balance: number;
  description: string;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  type: { 
    type: String, 
    enum: ['daily', 'hourly', 'message', 'gamble_win', 'gamble_lose', 'shop', 'transfer_in', 'transfer_out', 'pay', 'bonus'],
    required: true 
  },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

TransactionSchema.index({ guildId: 1, userId: 1, createdAt: -1 });

export const TransactionModel = mongoose.model<ITransaction>('Transaction', TransactionSchema);
