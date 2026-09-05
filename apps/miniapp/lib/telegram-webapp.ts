type TelegramWebAppLike = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
  BackButton?: {
    show?: () => void;
    hide?: () => void;
    onClick?: (callback: () => void) => void;
    offClick?: (callback: () => void) => void;
  };
  openTelegramLink?: (url: string) => void;
  openInvoice?: (
    invoiceLink: string,
    callback: (status: "paid" | "cancelled" | "failed") => void,
  ) => void;
};

type TelegramWindowLike = Window & {
  Telegram?: {
    WebApp?: TelegramWebAppLike;
  };
};

export function getTelegramWebApp(): TelegramWebAppLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as TelegramWindowLike).Telegram?.WebApp;
}
