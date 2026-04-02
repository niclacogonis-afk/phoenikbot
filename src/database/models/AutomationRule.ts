import mongoose, { Document, Schema } from 'mongoose';

export type AutomationAction = 'reply' | 'delete';

export interface IAutomationRule extends Document {
  guildId: string;
  name: string;
  enabled: boolean;
  /** Lowercase match: message content must include this substring */
  keyword: string;
  action: AutomationAction;
  /** Reply text when action is reply */
  replyText: string;
  cooldownSeconds: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationRuleSchema = new Schema<IAutomationRule>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    keyword: { type: String, required: true },
    action: { type: String, enum: ['reply', 'delete'], default: 'reply' },
    replyText: { type: String, default: '' },
    cooldownSeconds: { type: Number, default: 30 },
    lastTriggeredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AutomationRuleSchema.index({ guildId: 1, keyword: 1 });

export const AutomationRuleModel = mongoose.model<IAutomationRule>('AutomationRule', AutomationRuleSchema);
