export function DashboardSkeleton(): React.ReactNode {
  return (
    <main
      aria-label="Loading dashboard"
      className="mx-auto min-h-dvh w-full max-w-lg animate-pulse px-4 pb-28 pt-4"
    >
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
          <div className="h-3 w-20 rounded bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
        </div>
      </div>
      <div className="mt-6 h-40 rounded-[1.75rem] bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      <div className="mt-5 h-14 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      <div className="mt-8 space-y-3">
        <div className="h-5 w-28 rounded bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
        <div className="h-28 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
        <div className="h-28 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#e5e7eb)]" />
      </div>
    </main>
  );
}
