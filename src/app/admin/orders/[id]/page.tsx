import type { Metadata } from "next";

import { AdminShell } from "../../AdminShell";
import { PackClient } from "./PackClient";

export const metadata: Metadata = { title: "Weigh order · Operations" };

export default function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminShell
      title="Weigh this order"
      subtitle="Type what comes off the scale. The customer pays for the weight that reaches their door — never more than they authorised."
    >
      <PackClient params={params} />
    </AdminShell>
  );
}
