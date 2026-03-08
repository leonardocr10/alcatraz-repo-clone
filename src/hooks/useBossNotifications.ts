import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const NOTIFY_KEY = "boss-notify-enabled";

interface Boss {
  id: string;
  name: string;
  map_level: string | null;
  image_url: string | null;
}

interface BossSchedule {
  id: string;
  boss_id: string;
  spawn_time: string;
  notify_minutes_before: number;
}

async function showNotification(title: string, options: NotificationOptions) {
  // Try Service Worker first (works better in installed PWAs)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch (e) {
      console.log("[Notify] SW fallback to basic Notification", e);
    }
  }
  // Fallback to basic Notification API
  new Notification(title, options);
}

export function useBossNotifications() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(NOTIFY_KEY) === "true");
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const notifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setEnabled(true);
      localStorage.setItem(NOTIFY_KEY, "true");
      return true;
    }
    return false;
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      localStorage.setItem(NOTIFY_KEY, "false");
      return;
    }
    if (permission !== "granted") {
      const granted = await requestPermission();
      if (!granted) return;
    } else {
      setEnabled(true);
      localStorage.setItem(NOTIFY_KEY, "true");
    }
  }, [enabled, permission, requestPermission]);

  const updateMinutes = useCallback((mins: number) => {
    setNotifyMinutes(mins);
    localStorage.setItem(NOTIFY_MINUTES_KEY, String(mins));
  }, []);

  const sendTestNotification = useCallback(async () => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return false;
    }
    await showNotification("⚔️ Teste de Alerta - Painel AZ", {
      body: "🐉 Se você viu essa notificação, os alertas estão funcionando!",
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      tag: "test-" + Date.now(),
      requireInteraction: true,
    });
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const checkBosses = async () => {
      const [bossRes, schedRes] = await Promise.all([
        supabase.from("bosses").select("id, name, map_level, image_url"),
        supabase.from("boss_schedules").select("id, boss_id, spawn_time"),
      ]);

      const bosses = (bossRes.data || []) as Boss[];
      const schedules = (schedRes.data || []) as BossSchedule[];

      const now = new Date();
      const brazilOffset = -3 * 60;
      const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
      const currentMins = brazilTime.getHours() * 60 + brazilTime.getMinutes();

      for (const sched of schedules) {
        const [h, m] = sched.spawn_time.split(":").map(Number);
        const spawnMins = h * 60 + m;

        let diffTotal = spawnMins - currentMins;
        if (diffTotal < 0) diffTotal += 24 * 60;
        if (diffTotal >= 24 * 60 - 2) diffTotal = 0;

        const today = brazilTime.toISOString().split("T")[0];
        const key = `${sched.id}-${today}`;

        if (diffTotal <= notifyMinutes && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);

          const boss = bosses.find((b) => b.id === sched.boss_id);
          if (!boss) continue;

          const title = diffTotal === 0
            ? `🔥 ${boss.name} NASCEU!`
            : `⚔️ ${boss.name} em ${diffTotal}min!`;

          const body = boss.map_level
            ? `📍 ${boss.map_level} — Spawn às ${sched.spawn_time.substring(0, 5)}`
            : `⏰ Spawn às ${sched.spawn_time.substring(0, 5)}`;

          await showNotification(title, {
            body,
            icon: boss.image_url || "/pwa-icon-192.png",
            badge: "/pwa-icon-192.png",
            tag: key,
            requireInteraction: true,
          });
        }
      }

      const today = brazilTime.toISOString().split("T")[0];
      for (const key of notifiedRef.current) {
        if (!key.includes(today)) notifiedRef.current.delete(key);
      }
    };

    checkBosses();
    intervalRef.current = setInterval(checkBosses, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, permission, notifyMinutes]);

  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

  return {
    enabled,
    permission,
    notifyMinutes,
    supported: typeof Notification !== "undefined" && !isMobile,
    toggle,
    updateMinutes,
    sendTestNotification,
  };
}
