import mongoose, { Document, Schema } from 'mongoose';

export interface IStickyMessage extends Document {
  guildId: string;
  channelId: string;
  message: string;
  lastMessageId: string | null;
  enabled: boolean;
  updatedAt: Date;
}

const StickyMessageSchema = new Schema<IStickyMessage>({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  message: { type: String, required: true },
  lastMessageId: { type: String, default: null },
  enabled: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index for guild + channel
StickyMessageSchema.index({ guildId: 1, channelId: 1 }, { unique: true });

export const StickyMessageModel = mongoose.model<IStickyMessage>('StickyMessage', StickyMessageSchema);

// Helper functions
export async function getStickyMessage(guildId: string, channelId: string): Promise<IStickyMessage | null> {
  return StickyMessageModel.findOne({ guildId, channelId, enabled: true });
}

export async function getAllStickyMessages(guildId: string): Promise<IStickyMessage[]> {
  return StickyMessageModel.find({ guildId, enabled: true });
}

export async function setStickyMessage(
  guildId: string,
  channelId: string,
  message: string
): Promise<IStickyMessage> {
  return StickyMessageModel.findOneAndUpdate(
    { guildId, channelId },
    { 
      message,
      enabled: true,
      updatedAt: new Date(),
      $setOnInsert: { guildId, channelId, lastMessageId: null }
    },
    { upsert: true, new: true }
  );
}

export async function removeStickyMessage(guildId: string, channelId: string): Promise<void> {
  await StickyMessageModel.deleteOne({ guildId, channelId });
}

export async function disableStickyMessage(guildId: string, channelId: string): Promise<void> {
  await StickyMessageModel.findOneAndUpdate(
    { guildId, channelId },
    { enabled: false }
  );
}

export async function updateStickyMessageId(
  guildId: string,
  channelId: string,
  messageId: string
): Promise<void> {
  await StickyMessageModel.findOneAndUpdate(
    { guildId, channelId },
    { lastMessageId: messageId, updatedAt: new Date() }
  );
}
