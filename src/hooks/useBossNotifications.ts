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

let activeAlertInterval: ReturnType<typeof setInterval> | null = null;

function stopAlertSound() {
  if (activeAlertInterval) {
    clearInterval(activeAlertInterval);
    activeAlertInterval = null;
  }
}

function playSingleAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    const playDrum = (time: number, freq: number, vol: number, decay = 0.35) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + time);
      osc.frequency.exponentialRampToValueAtTime(35, now + time + decay);
      g.gain.setValueAtTime(vol, now + time);
      g.gain.exponentialRampToValueAtTime(0.001, now + time + decay + 0.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + decay + 0.1);
    };

    const playHorn = (time: number, freq: number, duration: number, vol: number) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc2.type = "sawtooth";
      osc2.frequency.value = freq * 1.005;
      osc3.type = "square";
      osc3.frequency.value = freq * 0.5;
      osc3.connect(g);
      g.gain.setValueAtTime(0.001, now + time);
      g.gain.linearRampToValueAtTime(vol, now + time + 0.12);
      g.gain.setValueAtTime(vol, now + time + duration - 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, now + time + duration);
      osc.connect(g);
      osc2.connect(g);
      g.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + duration);
      osc2.start(now + time);
      osc2.stop(now + time + duration);
      osc3.start(now + time);
      osc3.stop(now + time + duration);
    };

    const playString = (time: number, freq: number, duration: number, vol: number) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc2.type = "sawtooth";
      osc2.frequency.value = freq * 2.01;
      g.gain.setValueAtTime(0.001, now + time);
      g.gain.linearRampToValueAtTime(vol, now + time + 0.05);
      g.gain.setValueAtTime(vol * 0.8, now + time + duration * 0.6);
      g.gain.exponentialRampToValueAtTime(0.001, now + time + duration);
      osc.connect(g);
      osc2.connect(g);
      g.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + duration);
      osc2.start(now + time);
      osc2.stop(now + time + duration);
    };

    playDrum(0, 80, 0.6, 0.5);
    playDrum(0.55, 60, 0.5, 0.5);
    playDrum(1.0, 80, 0.55, 0.4);
    playString(1.2, 146.83, 0.5, 0.12);
    playString(1.7, 174.61, 0.5, 0.13);
    playString(2.2, 220.00, 0.5, 0.14);
    playString(2.7, 293.66, 0.7, 0.15);
    playDrum(3.4, 100, 0.55, 0.3);
    playDrum(3.6, 80, 0.5, 0.3);
    playDrum(3.8, 120, 0.6, 0.3);
    playDrum(4.0, 90, 0.5, 0.25);
    playDrum(4.15, 110, 0.55, 0.25);
    playDrum(4.3, 130, 0.6, 0.3);
    playHorn(4.5, 146.83, 0.8, 0.14);
    playHorn(5.3, 174.61, 0.6, 0.15);
    playHorn(5.9, 220.00, 1.0, 0.18);
    playString(6.5, 293.66, 1.0, 0.16);
    playString(6.5, 146.83, 1.0, 0.12);
    playDrum(6.5, 60, 0.7, 0.6);
  } catch (e) {
    console.log("[Notify] Could not play alert sound", e);
  }
}

function startAlertSoundLoop() {
  stopAlertSound();
  playSingleAlert();
  activeAlertInterval = setInterval(() => playSingleAlert(), 8500);
}

async function showNotification(title: string, options: NotificationOptions) {
  // Start looping alert sound
  startAlertSoundLoop();

  // Try Service Worker first (works better in installed PWAs)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      // SW notifications don't fire onclose easily, stop after 60s max
      setTimeout(stopAlertSound, 60000);
      return;
    } catch (e) {
      console.log("[Notify] SW fallback to basic Notification", e);
    }
  }
  // Fallback to basic Notification API
  const notif = new Notification(title, options);
  notif.onclose = () => stopAlertSound();
  notif.onclick = () => {
    stopAlertSound();
    window.focus();
    notif.close();
  };
  // Safety: stop after 60 seconds max
  setTimeout(stopAlertSound, 60000);
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
        supabase.from("boss_schedules").select("id, boss_id, spawn_time, notify_minutes_before"),
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

        if (diffTotal <= sched.notify_minutes_before && !notifiedRef.current.has(key)) {
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
  }, [enabled, permission]);

  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

  return {
    enabled,
    permission,
    supported: typeof Notification !== "undefined" && !isMobile,
    toggle,
    sendTestNotification,
  };
}
