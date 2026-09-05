import { OrderStatus } from "./order-status";
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<React.ReactNode> {
  const { orderNumber } = await params;
  return <OrderStatus orderNumber={orderNumber} />;
}
