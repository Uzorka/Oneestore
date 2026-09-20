import type { Metadata } from "next";

import { Container, BOTTOM_CLEARANCE } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { AccountShell } from "../AccountClient";
import { OrdersClient } from "./OrdersClient";

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
          <OrdersClient />
        </AccountShell>
      </Container>
    </main>
  );
}
