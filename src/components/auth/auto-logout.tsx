"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function AutoLogout() {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Auto logout failed", error);
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      void handleLogout();
    }, INACTIVITY_TIMEOUT_MS);
  };

  useEffect(() => {
    // Initialize timer
    resetTimer();

    // Setup event listeners for user activity
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

    const activityHandler = () => {
      resetTimer();
    };

    events.forEach((event) => {
      window.addEventListener(event, activityHandler, { passive: true });
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, activityHandler);
      });
    };
  }, []);

  return null;
}
