import mongoose, { Document, Schema } from 'mongoose';

export interface IBannedWord extends Document {
  guildId: string;
  word: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  language: string;
  action: 'warn' | 'mute' | 'kick' | 'ban';
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBannedWordData {
  guildId: string;
  word: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  language: string;
  action: 'warn' | 'mute' | 'kick' | 'ban';
  enabled: boolean;
}

const BannedWordSchema = new Schema<IBannedWord>(
  {
    guildId: { type: String, required: true, index: true },
    word: { type: String, required: true },
    severity: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'], 
      default: 'medium' 
    },
    language: { type: String, default: 'all' },
    action: { 
      type: String, 
      enum: ['warn', 'mute', 'kick', 'ban'], 
      default: 'warn' 
    },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

BannedWordSchema.index({ guildId: 1, word: 1 }, { unique: true });

export const BannedWordModel = mongoose.model<IBannedWord>('BannedWord', BannedWordSchema);

export const DEFAULT_BANNED_WORDS: IBannedWordData[] = [
  { guildId: '', word: 'nigger', severity: 'critical', language: 'en', action: 'ban', enabled: true },
  { guildId: '', word: 'faggot', severity: 'critical', language: 'en', action: 'ban', enabled: true },
  { guildId: '', word: 'nigga', severity: 'high', language: 'en', action: 'warn', enabled: true },
  { guildId: '', word: 'negro', severity: 'critical', language: 'it', action: 'ban', enabled: true },
  { guildId: '', word: 'frocio', severity: 'high', language: 'it', action: 'warn', enabled: true },
  { guildId: '', word: 'finocchio', severity: 'medium', language: 'it', action: 'warn', enabled: true },
  { guildId: '', word: 'maricon', severity: 'high', language: 'es', action: 'warn', enabled: true },
  { guildId: '', word: 'négro', severity: 'critical', language: 'fr', action: 'ban', enabled: true },
  { guildId: '', word: 'viado', severity: 'high', language: 'pt', action: 'warn', enabled: true },
  { guildId: '', word: 'free-robux-now', severity: 'critical', language: 'all', action: 'ban', enabled: true },
  { guildId: '', word: 'claim-your-prize', severity: 'high', language: 'all', action: 'warn', enabled: true },
  { guildId: '', word: 'verify-your-account', severity: 'high', language: 'all', action: 'warn', enabled: true },
];
