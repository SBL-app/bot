const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('apistatus')
        .setDescription('Vérifie l\'état de l\'API SBL'),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout
        await interaction.reply({ content: 'Vérification de l\'état de l\'API...', ephemeral: true });
        
        try {
            const startTime = Date.now();
            
            // Effectuer la requête vers l'API
            const response = await fetch(config.apiUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'SBL-Discord-Bot'
                },
                // Timeout de 10 secondes
                signal: AbortSignal.timeout(10000)
            });
            
            const responseTime = Date.now() - startTime;
            const statusColor = response.ok ? 0x00FF00 : 0xFF0000; // Vert si OK, rouge sinon
            const statusText = response.ok ? '✅ En ligne' : '❌ Hors ligne';
            
            const embed = new EmbedBuilder()
                .setColor(statusColor)
                .setTitle('État de l\'API SBL')
                .setURL(config.apiUrl)
                .addFields(
                    { name: 'Statut', value: statusText, inline: true },
                    { name: 'Code de réponse', value: response.status.toString(), inline: true },
                    { name: 'Temps de réponse', value: `${responseTime}ms`, inline: true },
                    { name: 'URL', value: config.apiUrl, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Dernière vérification' });
            
            // Si l'API répond, essayer de lire le contenu
            if (response.ok) {
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const data = await response.json();
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
                } catch (parseError) {
                    // Ignore les erreurs de parsing, on a déjà les infos de base
                }
            }
            
            await interaction.editReply({ content: null, embeds: [embed] });
            
        } catch (error) {
            let errorMessage = 'Erreur inconnue';
            let errorColor = 0xFF0000;
            
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
                .setColor(errorColor)
                .setTitle('État de l\'API SBL')
                .setURL(config.apiUrl)
                .addFields(
                    { name: 'Statut', value: '❌ Inaccessible', inline: true },
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'URL', value: config.apiUrl, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Dernière vérification' });
            
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
        }
    },
};
