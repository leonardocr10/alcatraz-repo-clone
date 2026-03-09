export const CLAN_ROLES = [
  { value: "lider", label: "Líder", emoji: "👑" },
  { value: "vice-lider", label: "Vice-Líder", emoji: "⚔️" },
  { value: "conselho", label: "Conselho", emoji: "🛡" },
  { value: "recrutador", label: "Recrutador", emoji: "📢" },
  { value: "vip", label: "VIP", emoji: "💎" },
  { value: "veterano", label: "Veterano", emoji: "⭐" },
  { value: "membro", label: "Membro", emoji: "" },
] as const;

export type ClanRole = typeof CLAN_ROLES[number]["value"];

export function getClanRoleEmoji(clanRole: string | null): string {
  if (!clanRole || clanRole === "membro") return "";
  return CLAN_ROLES.find(r => r.value === clanRole)?.emoji ?? "";
}

export function getClanRoleLabel(clanRole: string | null): string {
  if (!clanRole) return "Membro";
  return CLAN_ROLES.find(r => r.value === clanRole)?.label ?? "Membro";
}
