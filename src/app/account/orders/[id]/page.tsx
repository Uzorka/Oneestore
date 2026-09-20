import { Suspense } from "react";
import type { Metadata } from "next";

import { Container, BOTTOM_CLEARANCE } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { AccountShell } from "../../AccountClient";
import { OrderClient } from "./OrderClient";

export const metadata: Metadata = { title: "Your order" };

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main>
      <PageBar title="Your order" backHref="/account/orders" />
      <Container className={`pt-[92px] md:pt-[106px] ${BOTTOM_CLEARANCE}`}>
        <AccountShell title="Your order">
          {/* useSearchParams needs a boundary for the "just placed" banner. */}
          <Suspense fallback={null}>
            <OrderClient params={params} />
          </Suspense>
        </AccountShell>
      </Container>
    </main>
  );
}
