import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  ChatInputCommandInteraction,
  ButtonInteraction,
  Message,
} from 'discord.js';

export async function paginate(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  pages: EmbedBuilder[],
  timeout = 60000
): Promise<void> {
  if (pages.length === 0) return;
  if (pages.length === 1) {
    await interaction.reply({ embeds: [pages[0]!], ephemeral: true });
    return;
  }

  let current = 0;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('page_first').setEmoji('⏮️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('page_prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('page_next').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('page_last').setEmoji('⏭️').setStyle(ButtonStyle.Secondary)
  );

  function getEmbed(): EmbedBuilder {
    const embed = pages[current]!;
    embed.setFooter({ text: `Page ${current + 1} / ${pages.length}` });
    return embed;
  }

  const reply = await interaction.reply({
    embeds: [getEmbed()],
    components: [row],
    ephemeral: true,
    fetchReply: true,
  }) as Message;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout,
    filter: (i) => i.user.id === interaction.user.id,
  });

  collector.on('collect', async (i) => {
    if (i.customId === 'page_first') current = 0;
    else if (i.customId === 'page_prev') current = Math.max(0, current - 1);
    else if (i.customId === 'page_next') current = Math.min(pages.length - 1, current + 1);
    else if (i.customId === 'page_last') current = pages.length - 1;

    await i.update({ embeds: [getEmbed()] });
  });

  collector.on('end', () => {
    reply.edit({ components: [] }).catch(() => null);
  });
}
