import type { Metadata } from "next";

import { PageBar } from "@/components/TopBar";

import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main>
      <PageBar title="Checkout" backHref="/basket" />
      <div className="px-4.5 pt-[86px] pb-28">
        <CheckoutClient />
      </div>
    </main>
  );
}
