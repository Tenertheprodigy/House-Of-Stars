import Link from "next/link";
import { OrderSupportCard, SupportContacts } from "../../components/support";
import { TelegramBackButton } from "../../components/telegram-back-button";

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ orderNumber?: string }>;
}): Promise<React.ReactNode> {
  const candidate = (await searchParams).orderNumber;
  const orderNumber =
    candidate && /^\d{1,20}$/.test(candidate) ? candidate : null;
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-5 py-6">
      <TelegramBackButton />
      <Link
        href={orderNumber ? `/orders/${orderNumber}` : "/"}
        className="inline-flex min-h-11 items-center text-[var(--tg-theme-link-color,#3390ec)]"
      >
        ← Back
      </Link>
      <header className="mt-5">
        <h1 className="text-3xl font-bold">Contact Support</h1>
      </header>
      {orderNumber ? (
        <div className="mt-6">
          <OrderSupportCard orderNumber={orderNumber} title="Contact Support" />
        </div>
      ) : (
        <section className="mt-6 rounded-3xl bg-[var(--tg-theme-secondary-bg-color,#fff)] p-6">
          <SupportContacts />
        </section>
      )}
    </main>
  );
}
