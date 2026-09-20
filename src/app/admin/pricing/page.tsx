import type { Metadata } from "next";

import { AdminShell } from "../AdminShell";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = { title: "Prices & stock · Operations" };

export default function AdminPricingPage() {
  return (
    <AdminShell
      title="Prices & stock"
      subtitle="Prices in naira per kilogram, stock in kilograms. Changes go live only when you publish them."
    >
      <PricingClient />
    </AdminShell>
  );
}
