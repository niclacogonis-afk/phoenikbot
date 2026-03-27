import mongoose, { Document, Schema } from 'mongoose';

export interface ITag extends Document {
  guildId: string;
  name: string;
  aliases: string[];
  content: string;
  isEmbed: boolean;
  embedData: {
    title?: string;
    description?: string;
    color?: string;
    image?: string;
    footer?: string;
  } | null;
  authorId: string;
  uses: number;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    aliases: { type: [String], default: [] },
    content: { type: String, required: true },
    isEmbed: { type: Boolean, default: false },
    embedData: { type: Schema.Types.Mixed, default: null },
    authorId: { type: String, required: true },
    uses: { type: Number, default: 0 },
  },
  { timestamps: true }
);

TagSchema.index({ guildId: 1, name: 1 }, { unique: true });

export const TagModel = mongoose.model<ITag>('Tag', TagSchema);
