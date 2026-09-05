export function EmptyOrdersState(): React.ReactNode {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--tg-theme-hint-color,#8e8e93)]/35 px-5 py-8 text-center">
      <p className="font-semibold">No orders yet</p>
      <p className="mt-1 text-sm text-[var(--tg-theme-hint-color,#8e8e93)]">
        Your recent orders will appear here.
      </p>
    </div>
  );
}
