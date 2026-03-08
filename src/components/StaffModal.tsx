import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Swords, ShieldCheck, Megaphone, Star, User, FileText, X } from "lucide-react";
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
  "membro": <User className="w-4 h-4 text-muted-foreground" />,
};

interface RoleDescription {
  title: string;
  emoji: string;
  subtitle: string;
  duties: string[];
}

const ROLE_DESCRIPTIONS: Record<string, RoleDescription> = {
  "lider": {
    title: "Líder",
    emoji: "👑",
    subtitle: "Responsável máximo pelo clã e pelas decisões finais.",
    duties: [
      "Definir objetivos e direção do clã",
      "Nomear ou remover cargos",
      "Resolver conflitos internos",
      "Organizar eventos, guerras e atividades da guild",
      "Garantir que as regras sejam cumpridas",
    ],
  },
  "vice-lider": {
    title: "Vice-Líder",
    emoji: "⚔️",
    subtitle: "Braço direito do líder e responsável pela organização diária do clã.",
    duties: [
      "Assumir o comando na ausência do líder",
      "Auxiliar na administração da guild",
      "Coordenar recrutadores e conselho",
      "Monitorar comportamento dos membros",
      "Auxiliar na organização de eventos e UP em grupo",
    ],
  },
  "conselho": {
    title: "Conselho",
    emoji: "🛡️",
    subtitle: "Grupo de jogadores experientes que ajudam na tomada de decisões.",
    duties: [
      "Avaliar novos membros",
      "Auxiliar na resolução de conflitos",
      "Dar sugestões para melhorias do clã",
      "Ajudar na organização de eventos e estratégias",
      "Servir como exemplo para os demais membros",
    ],
  },
  "recrutador": {
    title: "Recrutador",
    emoji: "📢",
    subtitle: "Responsável pelo crescimento do clã.",
    duties: [
      "Recrutar novos jogadores",
      "Explicar regras do clã aos novos membros",
      "Avaliar comportamento e perfil dos candidatos",
      "Ajudar iniciantes dentro da guild",
      "Informar liderança sobre novos recrutamentos",
    ],
  },
  "veterano": {
    title: "Membro Veterano",
    emoji: "⭐",
    subtitle: "Jogadores antigos ou de confiança dentro da guild.",
    duties: [
      "Ajudar novos membros",
      "Participar das atividades do clã",
      "Manter o espírito de equipe",
      "Auxiliar em eventos e grupos de UP",
    ],
  },
  "membro": {
    title: "Membro",
    emoji: "🧙",
    subtitle: "Base do clã.",
    duties: [
      "Respeitar todos os membros",
      "Seguir as regras da guild",
      "Participar das atividades quando possível",
      "Manter bom comportamento dentro e fora da guild",
    ],
  },
};

function RoleDetailModal({ roleKey, open, onClose }: { roleKey: string | null; open: boolean; onClose: () => void }) {
  if (!roleKey) return null;
  const desc = ROLE_DESCRIPTIONS[roleKey];
  if (!desc) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <span>{desc.emoji}</span> {desc.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-body">{desc.subtitle}</p>
          <div>
            <p className="text-xs font-display font-bold uppercase tracking-wider text-muted-foreground mb-2">Funções</p>
            <ul className="space-y-1.5">
              {desc.duties.map((duty, i) => (
                <li key={i} className="flex items-start gap-2 text-sm font-body">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{duty}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StaffModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [staffByRole, setStaffByRole] = useState<Record<string, StaffMember[]>>({});
  const [detailRole, setDetailRole] = useState<string | null>(null);

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

  const orderedRoles = CLAN_ROLES.filter(r => r.value !== "membro");

  return (
    <>
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
                    <button
                      onClick={() => setDetailRole(role.value)}
                      className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                      title="Ver funções"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
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

      <RoleDetailModal roleKey={detailRole} open={!!detailRole} onClose={() => setDetailRole(null)} />
    </>
  );
}
