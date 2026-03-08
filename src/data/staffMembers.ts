export interface StaffRole {
  title: string;
  emoji: string;
  members: string[];
}

export const STAFF_ROLES: StaffRole[] = [
  { title: "LÍDER", emoji: "👑", members: ["Zeus"] },
  { title: "VICE-LÍDER", emoji: "⚔️", members: ["Mangaverde"] },
  { title: "CONSELHO", emoji: "🛡", members: ["FsPrime", "Nutella", "Brasileiro"] },
  { title: "RECRUTADOR", emoji: "📢", members: ["Danadinha"] },
  { title: "VETERANOS", emoji: "⭐", members: ["Encrenca", "Liang"] },
];

/** Case-insensitive lookup: returns the staff role title for a nickname, or null */
export function getStaffRole(nickname: string): string | null {
  const lower = nickname.toLowerCase();
  for (const role of STAFF_ROLES) {
    if (role.members.some(m => m.toLowerCase() === lower)) {
      return role.title;
    }
  }
  return null;
}

/** Case-insensitive lookup: returns the emoji for a nickname, or null */
export function getStaffEmoji(nickname: string): string | null {
  const lower = nickname.toLowerCase();
  for (const role of STAFF_ROLES) {
    if (role.members.some(m => m.toLowerCase() === lower)) {
      return role.emoji;
    }
  }
  return null;
}

/** Returns all staff nicknames (lowercase) for quick membership checks */
export function isStaff(nickname: string): boolean {
  const lower = nickname.toLowerCase();
  return STAFF_ROLES.some(role => role.members.some(m => m.toLowerCase() === lower));
}
