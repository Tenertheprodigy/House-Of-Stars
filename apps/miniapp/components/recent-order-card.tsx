import Link from "next/link";
import { OrderStatusBadge } from "./order-status-badge";

export interface RecentOrder {
  orderNumber: string;
  starsAmount: number;
  payoutAsset: string;
  status: string;
  createdAt: string;
}
export function RecentOrderCard({
  order,
}: {
  order: RecentOrder;
}): React.ReactNode {
  const displayNumber = order.orderNumber.padStart(6, "0");
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(order.createdAt));
  return (
    <Link
      href={`/orders/${encodeURIComponent(order.orderNumber)}`}
      className="block min-h-24 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition duration-150 hover:-translate-y-0.5 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Order #{displayNumber}</p>
          <p className="mt-1 text-xs text-[var(--tg-theme-hint-color,#8e8e93)]">
            {date}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="font-semibold">⭐ {order.starsAmount.toLocaleString()}</p>
        <p className="text-sm font-medium text-[var(--tg-theme-hint-color,#8e8e93)]">
          {order.payoutAsset}
        </p>
      </div>
    </Link>
  );
}
