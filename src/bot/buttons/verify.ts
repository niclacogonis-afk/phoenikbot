import {
  ButtonInteraction, GuildMember, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} from 'discord.js';
import { ButtonHandler } from '../../types';
import { BotClient } from '../client';
import { getGuild } from '../../database/models/Guild';
import { VerificationManager } from '../../modules/verification/VerificationManager';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embed';

const handler: ButtonHandler = {
  customId: 'verify',

  async execute(interaction: ButtonInteraction, client: BotClient) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    const parts = interaction.customId.split(':');
    const action = parts[1]!;

    if (action === 'start') {
      const guild = await getGuild(interaction.guild.id);
      const mode = (guild as any).verifyMode as string ?? 'button';
      const verifyRole = (guild as any).verifyRole as string | undefined;

      if (!verifyRole) {
        await interaction.reply({ embeds: [errorEmbed('Not Configured')], ephemeral: true });
        return;
      }

      if (mode === 'button') {
        await VerificationManager.grantVerification(interaction.member, verifyRole);
        await interaction.reply({ embeds: [successEmbed('Verified!', 'You now have access to the server.')], ephemeral: true });
        return;
      }

      if (mode === 'captcha') {
        // Generate code first, then show modal immediately
        const code = VerificationManager.generateCode(6);
        const modal = new ModalBuilder()
          .setCustomId(`verify:captcha:${verifyRole}:${code}`)
          .setTitle('Captcha Verification')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('code')
                .setLabel(`Enter the code: ${code}`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(8)
            )
          );
        // Save code to database after showing modal to avoid timeout
        await interaction.showModal(modal);
        await VerificationManager.startCaptchaWithCode(interaction.member, code);
        return;
      }

      if (mode === 'roblox') {
        const code = await VerificationManager.startRobloxVerify(interaction.member);
        await interaction.reply({
          embeds: [infoEmbed('Roblox Verification',
            `**Step 1:** Copy this code:\n\`\`\`${code}\`\`\`\n**Step 2:** Paste it in your [Roblox profile bio](https://www.roblox.com/my/account#!/info)\n**Step 3:** Run \`/verify roblox <your-username>\`\n\nCode expires in **15 minutes**.`
          )],
          ephemeral: true,
        });
      }
    }
  },
};

export default handler;
