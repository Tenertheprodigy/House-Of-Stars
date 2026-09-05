import Link from "next/link";
export function PrimaryActionButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--tg-theme-button-color,#3390ec)] px-6 text-base font-semibold text-[var(--tg-theme-button-text-color,#fff)] shadow-sm transition duration-150 hover:brightness-105 active:scale-[0.98]"
    >
      {children}
    </Link>
  );
}
