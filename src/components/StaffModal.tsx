import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Swords, ShieldCheck, Megaphone, Star } from "lucide-react";
import { STAFF_ROLES } from "@/data/staffMembers";

interface StaffMember {
  nickname: string;
  classIcon: string | null;
  className: string | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  "LÍDER": <Crown className="w-4 h-4 text-primary" />,
  "VICE-LÍDER": <Swords className="w-4 h-4 text-destructive" />,
  "CONSELHO": <ShieldCheck className="w-4 h-4 text-accent-foreground" />,
  "RECRUTADOR": <Megaphone className="w-4 h-4 text-secondary-foreground" />,
  "VETERANOS": <Star className="w-4 h-4 text-primary" />,
};

export function StaffModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [staffData, setStaffData] = useState<Record<string, StaffMember>>({});

  useEffect(() => {
    if (!open) return;
    const allNicks = STAFF_ROLES.flatMap(g => g.members);

    // Fetch all users and match case-insensitively
    supabase
      .from("users")
      .select("nickname, class")
      .then(async ({ data: allUsers }) => {
        if (!allUsers) return;

        const lowerNicks = allNicks.map(n => n.toLowerCase());
        const users = allUsers.filter(u => lowerNicks.includes(u.nickname.toLowerCase()));

        const classes = [...new Set(users.map(u => u.class).filter(Boolean))] as string[];
        const { data: classData } = classes.length > 0
          ? await supabase.from("character_classes").select("name, image_url").in("name", classes as any)
          : { data: [] };

        const classMap = new Map<string, string | null>(
          (classData ?? []).map(c => [c.name, c.image_url] as [string, string | null])
        );

        const map: Record<string, StaffMember> = {};
        users.forEach(u => {
          // Store with lowercase key for case-insensitive lookup
          map[u.nickname.toLowerCase()] = {
            nickname: u.nickname,
            className: u.class as string | null,
            classIcon: u.class ? classMap.get(u.class) ?? null : null,
          };
        });
        setStaffData(map);
      });
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-center">Staff do Clã</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {STAFF_ROLES.map(group => (
            <div key={group.title}>
              <div className="flex items-center gap-2 mb-2">
                {ROLE_ICONS[group.title]}
                <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </span>
              </div>
              <div className="space-y-1.5 pl-6">
                {group.members.map(nick => {
                  const member = staffData[nick.toLowerCase()];
                  const displayName = member?.nickname ?? nick;
                  return (
                    <div key={nick} className="flex items-center gap-2.5 py-1">
                      {member?.classIcon ? (
                        <img src={member.classIcon} alt="" className="w-6 h-6 rounded-lg object-cover border border-border/40" />
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {nick.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-body font-medium">{displayName}</span>
                      {member?.className && (
                        <span className="text-[10px] text-muted-foreground font-body">{member.className}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
