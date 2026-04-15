import { createCommand } from '@/builders/CommandBuilder'
import { MessageFlags, PermissionFlagsBits, EmbedBuilder } from 'discord.js'

export default createCommand(
  'roles',
  'Manage role groups and uniqueness',
  (builder) => {
    builder
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName('grouped-list')
          .setDescription('List all grouped role sets')
      )
      .addSubcommand((sub) =>
        sub
          .setName('grouped-add')
          .setDescription('Create a new grouped role set')
          .addStringOption((opt) => opt.setName('name').setDescription('Set name').setRequired(true))
          .addStringOption((opt) => opt.setName('roles').setDescription('Comma-separated role IDs or mentions').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('grouped-remove')
          .setDescription('Remove a grouped role set')
          .addStringOption((opt) => opt.setName('name').setDescription('Set name').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('unique-list')
          .setDescription('List all unique role sets')
      )
      .addSubcommand((sub) =>
        sub
          .setName('unique-add')
          .setDescription('Create a new unique role set')
          .addStringOption((opt) => opt.setName('name').setDescription('Set name').setRequired(true))
          .addStringOption((opt) => opt.setName('roles').setDescription('Comma-separated role IDs or mentions').setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName('unique-remove')
          .setDescription('Remove a unique role set')
          .addStringOption((opt) => opt.setName('name').setDescription('Set name').setRequired(true))
      )
      .execute(async ({ interaction, client }) => {
        const subcommand = interaction.options.getSubcommand()
        const db = client.databaseManager.getSqlite()
        const guildId = interaction.guildId

        if (subcommand === 'grouped-add' || subcommand === 'unique-add') {
          const type = subcommand.startsWith('grouped') ? 'grouped' : 'unique'
          const name = interaction.options.getString('name', true)
          const rolesRaw = interaction.options.getString('roles', true)

          // Clean up role IDs from mentions if present
          const roleIds = rolesRaw.match(/\d+/g) || []
          if (roleIds.length < 2) {
            return interaction.reply({ content: '❌ Please provide at least two roles.', flags: MessageFlags.Ephemeral })
          }

          try {
            db.prepare(
              'INSERT OR REPLACE INTO role_sets (guild_id, name, roles, type) VALUES (?, ?, ?, ?)'
            ).run(guildId, name, JSON.stringify(roleIds), type)

            return interaction.reply({
              content: `✅ Successfully created ${type} role set **${name}** with ${roleIds.length} roles.`,
              flags: MessageFlags.Ephemeral
            })
          } catch (error: any) {
            return interaction.reply({ content: `❌ Database error: ${error.message}`, flags: MessageFlags.Ephemeral })
          }
        }

        if (subcommand === 'grouped-remove' || subcommand === 'unique-remove') {
          const name = interaction.options.getString('name', true)
          const type = subcommand.startsWith('grouped') ? 'grouped' : 'unique'

          const result = db.prepare(
            'DELETE FROM role_sets WHERE guild_id = ? AND name = ? AND type = ?'
          ).run(guildId, name, type)

          if (result.changes > 0) {
            return interaction.reply({ content: `✅ Removed ${type} set **${name}**.`, flags: MessageFlags.Ephemeral })
          } else {
            return interaction.reply({ content: `❌ Set **${name}** not found.`, flags: MessageFlags.Ephemeral })
          }
        }

        if (subcommand === 'grouped-list' || subcommand === 'unique-list') {
          const type = subcommand.startsWith('grouped') ? 'grouped' : 'unique'
          const sets = db.prepare(
            'SELECT * FROM role_sets WHERE guild_id = ? AND type = ?'
          ).all(guildId)

          if (sets.length === 0) {
            return interaction.reply({ content: `No ${type} role sets configured.`, flags: MessageFlags.Ephemeral })
          }

          const embed = new EmbedBuilder()
            .setTitle(`List of ${type === 'grouped' ? 'Grouped' : 'Unique'} Role Sets`)
            .setColor(type === 'grouped' ? 0x5865f2 : 0xeb459e)

          sets.forEach((set: any, index: number) => {
            const roleIds = JSON.parse(set.roles)
            const roleMentions = roleIds.map((id: string) => `<@&${id}>`).join('\n')
            embed.addFields({ name: `#${index + 1} ${set.name}`, value: roleMentions, inline: true })
          })

          return interaction.reply({ embeds: [embed] })
        }
      })
  }
)
