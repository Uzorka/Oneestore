import type { Metadata } from "next";

import { PageBar } from "@/components/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <main>
      <PageBar title="Your orders" backHref="/" />
      <div className="px-4.5 pt-[86px] pb-28">
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5h9l4 4v13H6z" />
              <path d="M9 11h7M9 15h7" />
            </svg>
          }
          title="No orders yet"
          body="Once you order, you can follow it from the jetty to your door."
          actionLabel="Browse Seafood"
          actionHref="/shop"
        />
      </div>
    </main>
  );
}
