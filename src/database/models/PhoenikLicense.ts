import mongoose, { Document, Schema } from 'mongoose';

export interface IPhoenikLicense extends Document {
  guildId: string;
  discordId: string;
  key: string;
  hwid: string | null;
  type: string;
  expiresAt: Date;
  roleId: string;
  verifiedAt: Date;
  active: boolean;
}

const PhoenikLicenseSchema = new Schema<IPhoenikLicense>(
  {
    guildId: { type: String, required: true, index: true },
    discordId: { type: String, required: true },
    key: { type: String, required: true },
    hwid: { type: String, default: null },
    type: { type: String, default: 'free' },
    expiresAt: { type: Date, required: true },
    roleId: { type: String, required: true },
    verifiedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PhoenikLicenseSchema.index({ guildId: 1, discordId: 1 });
PhoenikLicenseSchema.index({ expiresAt: 1, active: 1 });

export const PhoenikLicenseModel = mongoose.model<IPhoenikLicense>('PhoenikLicense', PhoenikLicenseSchema);
