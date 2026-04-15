import { Events, GuildMember, PermissionFlagsBits } from "discord.js";
import { createEvent } from "@/builders/EventBuilder";
import Logger from "@/utilities/Logger";

export default createEvent(Events.GuildMemberUpdate, {
  execute: async ({ args: [oldMember, newMember], client }) => {
    // Check for role changes
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    if (oldRoles.size === newRoles.size && oldRoles.every(r => newRoles.has(r.id))) {
      return; // No role changes
    }

    const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
    if (addedRoles.size === 0) return; // Only interested in additions

    const db = client.databaseManager.getSqlite();
    const guildId = newMember.guild.id;

    // Fetch all sets for this guild
    const sets = db.prepare("SELECT * FROM role_sets WHERE guild_id = ?").all(guildId);
    if (sets.length === 0) return;

    for (const set of sets) {
      const roleIds = JSON.parse(set.roles) as string[];
      const type = set.type;

      // Check if any of the ADDED roles are part of this set
      const triggerRole = addedRoles.find(r => roleIds.includes(r.id));
      if (!triggerRole) continue;

      if (type === "grouped") {
        // GROUPED: Ensure member has ALL roles in the set
        const missingRoles = roleIds.filter(id => !newMember.roles.cache.has(id));
        if (missingRoles.length > 0) {
          try {
            await newMember.roles.add(missingRoles, `Role Groups: Grouped set "${set.name}" triggered by adding ${triggerRole.name}`);
            Logger.info(`[RoleSets] Added roles [${missingRoles.join(", ")}] to ${newMember.user.tag} in guild ${guildId} (Grouped set: ${set.name})`);
          } catch (error: any) {
            Logger.error(`[RoleSets] Failed to add grouped roles to ${newMember.user.tag}: ${error.message}`);
          }
        }
      } else if (type === "unique") {
        // UNIQUE: Ensure member has ONLY the newly added role from this set
        const rolesToRemove = roleIds.filter(id => id !== triggerRole.id && newMember.roles.cache.has(id));
        if (rolesToRemove.length > 0) {
          try {
            await newMember.roles.remove(rolesToRemove, `Role Groups: Unique set "${set.name}" triggered by adding ${triggerRole.name}`);
            Logger.info(`[RoleSets] Removed roles [${rolesToRemove.join(", ")}] from ${newMember.user.tag} in guild ${guildId} (Unique set: ${set.name})`);
          } catch (error: any) {
            Logger.error(`[RoleSets] Failed to remove unique roles from ${newMember.user.tag}: ${error.message}`);
          }
        }
      }
    }
  },
});
