import type { Metadata } from "next";

import { AdminShell } from "../AdminShell";
import { OrdersQueueClient } from "./OrdersQueueClient";

export const metadata: Metadata = { title: "Packing queue · Operations" };

export default function AdminOrdersPage() {
  return (
    <AdminShell
      title="Packing queue"
      subtitle="Every order, and what it is waiting for. Open one to weigh it."
    >
      <OrdersQueueClient />
    </AdminShell>
  );
}
