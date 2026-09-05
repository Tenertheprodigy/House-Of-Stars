interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}
interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand?(): void;
  openTelegramLink?(url: string): void;
  BackButton?: TelegramBackButton;
}
interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
