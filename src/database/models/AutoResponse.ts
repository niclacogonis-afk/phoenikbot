import mongoose, { Document, Schema } from 'mongoose';

export interface IAutoResponse extends Document {
  guildId: string;
  triggers: string[];
  response: string;
  isEmbed: boolean;
  embedData: Record<string, string> | null;
  includeTicketButton: boolean;
  cooldownSeconds: number;
  lastTriggered: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const AutoResponseSchema = new Schema<IAutoResponse>(
  {
    guildId: { type: String, required: true, index: true },
    triggers: { type: [String], required: true },
    response: { type: String, required: true },
    isEmbed: { type: Boolean, default: false },
    embedData: { type: Schema.Types.Mixed, default: null },
    includeTicketButton: { type: Boolean, default: false },
    cooldownSeconds: { type: Number, default: 30 },
    lastTriggered: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

export const AutoResponseModel = mongoose.model<IAutoResponse>('AutoResponse', AutoResponseSchema);
