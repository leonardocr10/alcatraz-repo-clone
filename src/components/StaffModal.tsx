import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Swords, ShieldCheck, Megaphone, Star, User } from "lucide-react";
import { CLAN_ROLES } from "@/data/staffMembers";

interface StaffMember {
  nickname: string;
  classIcon: string | null;
  className: string | null;
  clan_role: string;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  "lider": <Crown className="w-4 h-4 text-primary" />,
  "vice-lider": <Swords className="w-4 h-4 text-destructive" />,
  "conselho": <ShieldCheck className="w-4 h-4 text-accent-foreground" />,
  "recrutador": <Megaphone className="w-4 h-4 text-secondary-foreground" />,
  "veterano": <Star className="w-4 h-4 text-primary" />,
};

export function StaffModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [staffByRole, setStaffByRole] = useState<Record<string, StaffMember[]>>({});

  useEffect(() => {
    if (!open) return;

    supabase
      .from("users")
      .select("nickname, class, clan_role")
      .neq("clan_role", "membro")
      .then(async ({ data: users }) => {
        if (!users) return;

        const classes = [...new Set(users.map(u => u.class).filter(Boolean))] as string[];
        const { data: classData } = classes.length > 0
          ? await supabase.from("character_classes").select("name, image_url").in("name", classes as any)
          : { data: [] };

        const classMap = new Map<string, string | null>(
          (classData ?? []).map(c => [c.name, c.image_url] as [string, string | null])
        );

        const grouped: Record<string, StaffMember[]> = {};
        users.forEach(u => {
          const role = (u as any).clan_role || "membro";
          if (!grouped[role]) grouped[role] = [];
          grouped[role].push({
            nickname: u.nickname,
            className: u.class as string | null,
            classIcon: u.class ? classMap.get(u.class as string) ?? null : null,
            clan_role: role,
          });
        });
        setStaffByRole(grouped);
      });
  }, [open]);

  // Order roles as defined in CLAN_ROLES (excluding membro)
  const orderedRoles = CLAN_ROLES.filter(r => r.value !== "membro");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-center">Staff do Clã</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {orderedRoles.map(role => {
            const members = staffByRole[role.value];
            if (!members || members.length === 0) return null;
            return (
              <div key={role.value}>
                <div className="flex items-center gap-2 mb-2">
                  {ROLE_ICONS[role.value] ?? <User className="w-4 h-4 text-muted-foreground" />}
                  <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                    {role.label}
                  </span>
                </div>
                <div className="space-y-1.5 pl-6">
                  {members.map(member => (
                    <div key={member.nickname} className="flex items-center gap-2.5 py-1">
                      {member.classIcon ? (
                        <img src={member.classIcon} alt="" className="w-6 h-6 rounded-lg object-cover border border-border/40" />
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {member.nickname.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-body font-medium">{member.nickname}</span>
                      {member.className && (
                        <span className="text-[10px] text-muted-foreground font-body">{member.className}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
