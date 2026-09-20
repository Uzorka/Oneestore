import type { Metadata } from "next";

import { PageBar } from "@/components/TopBar";

import { BasketClient } from "./BasketClient";

export const metadata: Metadata = { title: "Basket" };

export default function BasketPage() {
  return (
    <main>
      <PageBar title="Your basket" backHref="/shop" />
      <div className="px-4.5 pt-[86px] pb-40">
        <BasketClient />
      </div>
    </main>
  );
}
