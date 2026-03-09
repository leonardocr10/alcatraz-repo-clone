import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function DiscordFloatingButton() {
  const [hidden, setHidden] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [discordLink, setDiscordLink] = useState("https://discord.gg/pSuaEUQN");
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0, moved: false });
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("app_config").select("discord_link").eq("id", "main").maybeSingle().then(({ data }) => {
      if (data?.discord_link) setDiscordLink(data.discord_link);
    });
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    if (!dragRef.current.moved) {
      window.open("https://discord.gg/pSuaEUQN", "_blank", "noopener,noreferrer");
    }
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="fixed z-50 select-none touch-none"
      style={{
        bottom: `calc(5rem - ${pos.y}px)`,
        right: `calc(1.5rem - ${pos.x}px)`,
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setHidden(true); }}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground z-10"
      >
        <X className="w-3 h-3" />
      </button>
      <div
        className={`w-14 h-14 rounded-full bg-[hsl(235,86%,65%)] hover:bg-[hsl(235,86%,55%)] text-white shadow-lg hover:shadow-xl transition-shadow duration-300 flex items-center justify-center cursor-grab ${dragging ? "cursor-grabbing scale-110" : ""}`}
        title="Entrar no Discord"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      </div>
    </div>
  );
}
