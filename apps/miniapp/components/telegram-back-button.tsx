"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getTelegramWebApp } from "../lib/telegram-webapp";
export function TelegramBackButton(): React.ReactNode {
  const router = useRouter();
  useEffect(() => {
    const button = getTelegramWebApp()?.BackButton;
    const goBack = (): void => router.back();
    button?.show?.();
    button?.onClick?.(goBack);
    return () => {
      button?.offClick?.(goBack);
      button?.hide?.();
    };
  }, [router]);
  return null;
}
