import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const NOTIFY_KEY = "boss-notify-enabled";
const SOUND_KEY = "boss-notify-sound";

interface Boss {
  id: string;
  name: string;
  map_level: string | null;
  image_url: string | null;
  audio_url: string | null;
}

interface BossSchedule {
  id: string;
  boss_id: string;
  spawn_time: string;
  notify_minutes_before: number;
}

let activeAlertInterval: ReturnType<typeof setInterval> | null = null;
let isSpeaking = false;
let activeAudio: HTMLAudioElement | null = null;

function stopAlertSound() {
  if (activeAlertInterval) {
    clearInterval(activeAlertInterval);
    activeAlertInterval = null;
  }
  isSpeaking = false;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
}

function playBossAudio(audioUrl: string) {
  stopAlertSound();
  try {
    const audio = new Audio(audioUrl);
    audio.volume = 1;
    activeAudio = audio;
    audio.onended = () => { activeAudio = null; };
    audio.onerror = () => { activeAudio = null; };
    audio.play().catch(() => { activeAudio = null; });
  } catch (e) {
    console.log("[Notify] Could not play boss audio", e);
  }
}

function speakAlert(bossName?: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    if (isSpeaking && window.speechSynthesis.speaking) return;
    window.speechSynthesis.cancel();
    const name = bossName || "Boss";
    const text = `Alerta de Boss. ${name}.`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith("pt") && v.name.toLowerCase().includes("google"))
      || voices.find(v => v.lang.startsWith("pt-BR"))
      || voices.find(v => v.lang.startsWith("pt"));
    if (ptVoice) utterance.voice = ptVoice;
    isSpeaking = true;
    utterance.onend = () => { isSpeaking = false; };
    utterance.onerror = () => { isSpeaking = false; };
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.log("[Notify] Could not speak alert", e);
    isSpeaking = false;
  }
}

async function showNotification(title: string, options: NotificationOptions, soundEnabled: boolean, bossName?: string, audioUrl?: string | null) {
  if (soundEnabled) {
    if (audioUrl) {
      // Play custom audio once, no loop
      playBossAudio(audioUrl);
    } else {
      // Fallback: speak once (no loop)
      stopAlertSound();
      speakAlert(bossName);
    }
  }

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    } catch (e) {
      console.log("[Notify] SW fallback to basic Notification", e);
    }
  }
  const notif = new Notification(title, options);
  notif.onclose = () => stopAlertSound();
  notif.onclick = () => {
    stopAlertSound();
    window.focus();
    notif.close();
  };
}

export function useBossNotifications() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(NOTIFY_KEY) === "true");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem(SOUND_KEY) !== "false");
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );

  const notifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

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

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_KEY, String(next));
    if (!next) stopAlertSound();
  }, [soundEnabled]);

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
    }, soundEnabledRef.current, "Boss Teste");
    return true;
  }, []);

  useEffect(() => {
    if (!enabled || permission !== "granted") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const checkBosses = async () => {
      const [bossRes, schedRes] = await Promise.all([
        supabase.from("bosses").select("id, name, map_level, image_url, audio_url") as any,
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
          }, soundEnabledRef.current, boss.name);
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
    soundEnabled,
    supported: typeof Notification !== "undefined" && !isMobile,
    toggle,
    toggleSound,
    sendTestNotification,
  };
}
