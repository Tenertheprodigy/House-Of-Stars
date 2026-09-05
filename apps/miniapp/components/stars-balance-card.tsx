export type StarsBalanceState =
  | { status: "loading" }
  | { status: "error"; message?: string }
  | { status: "unavailable" }
  | { status: "available"; balance: number };

export function StarsBalanceCard({
  state,
}: {
  state: StarsBalanceState;
}): React.ReactNode {
  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#7c5cff] via-[#6d4ee8] to-[#4c33bd] p-6 text-white shadow-[0_18px_45px_rgba(76,51,189,0.24)] transition-transform duration-200 active:scale-[0.995]">
      {state.status === "loading" ? (
        <div aria-label="Loading Stars balance" className="animate-pulse">
          <div className="h-4 w-24 rounded bg-white/25" />
          <div className="mt-4 h-10 w-40 rounded bg-white/25" />
        </div>
      ) : null}
      {state.status === "available" ? (
        <>
          <p className="text-sm font-medium text-white/75">Your Stars</p>
          <p className="mt-2 text-4xl font-bold tracking-tight">
            ⭐ {state.balance.toLocaleString()}
          </p>
        </>
      ) : null}
      {state.status === "unavailable" ? (
        <>
          <p className="text-sm font-medium text-white/75">Stars</p>
          <p className="mt-3 max-w-xs text-xl font-semibold leading-7">
            Enter an amount when you start an order
          </p>
        </>
      ) : null}
      {state.status === "error" ? (
        <>
          <p className="text-sm font-medium text-white/75">Stars</p>
          <p className="mt-3 text-lg font-semibold">
            {state.message ?? "Balance unavailable right now"}
          </p>
        </>
      ) : null}
    </section>
  );
}
