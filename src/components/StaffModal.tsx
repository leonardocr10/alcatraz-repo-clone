import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Swords, ShieldCheck, Megaphone, Star } from "lucide-react";

interface StaffMember {
  nickname: string;
  classIcon: string | null;
  className: string | null;
}

interface StaffGroup {
  title: string;
  emoji: React.ReactNode;
  members: string[];
}

const STAFF_GROUPS: StaffGroup[] = [
  { title: "LÍDER", emoji: <Crown className="w-4 h-4 text-yellow-400" />, members: ["Zeus"] },
  { title: "VICE-LÍDER", emoji: <Swords className="w-4 h-4 text-red-400" />, members: ["Mangaverde"] },
  { title: "CONSELHO", emoji: <ShieldCheck className="w-4 h-4 text-blue-400" />, members: ["FsPrime", "Nutella", "Brasileiro"] },
  { title: "RECRUTADOR", emoji: <Megaphone className="w-4 h-4 text-green-400" />, members: ["Danadinha"] },
  { title: "VETERANOS", emoji: <Star className="w-4 h-4 text-amber-400" />, members: ["Encrenca", "Liang"] },
];

export function StaffModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [staffData, setStaffData] = useState<Record<string, StaffMember>>({});

  useEffect(() => {
    if (!open) return;
    const allNicks = STAFF_GROUPS.flatMap(g => g.members);

    supabase
      .from("users")
      .select("nickname, class")
      .in("nickname", allNicks)
      .then(async ({ data: users }) => {
        if (!users) return;

        // Get unique classes
        const classes = [...new Set(users.map(u => u.class).filter(Boolean))] as string[];
        const { data: classData } = await supabase
          .from("character_classes")
          .select("name, image_url")
          .in("name", classes as any);

        const classMap = new Map(classData?.map(c => [c.name, c.image_url]) ?? []);

        const map: Record<string, StaffMember> = {};
        users.forEach(u => {
          map[u.nickname] = {
            nickname: u.nickname,
            className: u.class,
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
          {STAFF_GROUPS.map(group => (
            <div key={group.title}>
              <div className="flex items-center gap-2 mb-2">
                {group.emoji}
                <span className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </span>
              </div>
              <div className="space-y-1.5 pl-6">
                {group.members.map(nick => {
                  const member = staffData[nick];
                  return (
                    <div key={nick} className="flex items-center gap-2.5 py-1">
                      {member?.classIcon ? (
                        <img src={member.classIcon} alt="" className="w-6 h-6 rounded-lg object-cover border border-border/40" />
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {nick.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-body font-medium">{nick}</span>
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
