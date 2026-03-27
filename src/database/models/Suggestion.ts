import mongoose, { Document, Schema } from 'mongoose';

export interface ISuggestion extends Document {
  guildId: string;
  channelId: string | null;
  messageId: string | null;
  userId: string;
  content: string;
  upvotes: string[];
  downvotes: string[];
  status: 'pending' | 'approved' | 'rejected';
  staffComment: string | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SuggestionSchema = new Schema<ISuggestion>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, default: null },
    messageId: { type: String, default: null },
    userId: { type: String, required: true },
    content: { type: String, required: true },
    upvotes: { type: [String], default: [] },
    downvotes: { type: [String], default: [] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    staffComment: { type: String, default: null },
    reviewedBy: { type: String, default: null },
  },
  { timestamps: true }
);

export const SuggestionModel = mongoose.model<ISuggestion>('Suggestion', SuggestionSchema);
