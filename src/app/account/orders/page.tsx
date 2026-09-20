import type { Metadata } from "next";

import { Container, BOTTOM_CLEARANCE } from "@/components/Container";
import { PageBar } from "@/components/TopBar";
import { EmptyState } from "@/components/ui/EmptyState";

import { AccountShell } from "../AccountClient";

export const metadata: Metadata = { title: "Orders" };

/**
 * Orders live inside the account, not in the main navigation: an order is
 * something the customer owns, not a place to browse.
 */
export default function OrdersPage() {
  return (
    <main>
      <PageBar title="Orders" backHref="/account" />
      <Container className={`pt-[92px] md:pt-[106px] ${BOTTOM_CLEARANCE}`}>
        <AccountShell title="Orders">
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
        </AccountShell>
      </Container>
    </main>
  );
}
