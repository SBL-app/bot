import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ApiClient } from '../utils/apiClient';

export const data = new SlashCommandBuilder()
    .setName('apistatus')
    .setDescription('Vérifie l\'état de l\'API SBL');
export async function execute(interaction) {
    // Répondre immédiatement pour éviter le timeout
    await interaction.reply({ content: 'Vérification de l\'état de l\'API...', ephemeral: true });

    try {
        const apiClient = new ApiClient();
        const result = await apiClient.testConnection();

        const statusColor = result.isOnline ? 0x00FF00 : 0xFF0000; // Vert si OK, rouge sinon
        const statusText = result.isOnline ? '✅ En ligne' : '❌ Hors ligne';

        const embed = new EmbedBuilder()
            .setColor(statusColor)
            .setTitle('État de l\'API SBL')
            .setURL(apiClient.baseUrl)
            .addFields(
                { name: 'Statut', value: statusText, inline: true },
                { name: 'Code de réponse', value: result.status.toString(), inline: true },
                { name: 'Temps de réponse', value: `${result.responseTime}ms`, inline: true },
                { name: 'URL', value: apiClient.baseUrl, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Dernière vérification' });

        // Si l'API répond et qu'on a des infos supplémentaires
        if (result.isOnline && result.apiInfo) {
            const data = result.apiInfo;
            if (data.version || data.status || data.name) {
                let apiInfo = '';
                if (data.name) apiInfo += `Nom: ${data.name}\n`;
                if (data.version) apiInfo += `Version: ${data.version}\n`;
                if (data.status) apiInfo += `Statut: ${data.status}`;

                if (apiInfo) {
                    embed.addFields({ name: 'Informations API', value: apiInfo, inline: false });
                }
            }
        }

        await interaction.editReply({ content: null, embeds: [embed] });

    } catch (error) {
        let errorMessage = 'Erreur inconnue';

        if (error.name === 'TimeoutError') {
            errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Impossible de résoudre le nom de domaine';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connexion refusée par le serveur';
        } else {
            errorMessage = error.message || 'Erreur de connexion';
        }

        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('État de l\'API SBL')
            .addFields(
                { name: 'Statut', value: '❌ Inaccessible', inline: true },
                { name: 'Erreur', value: errorMessage, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Dernière vérification' });

        await interaction.editReply({ content: null, embeds: [errorEmbed] });
    }
}
