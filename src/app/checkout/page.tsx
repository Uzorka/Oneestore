import type { Metadata } from "next";

import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <main>
      <PageBar title="Checkout" backHref="/basket" />
      <Container className={`max-w-[720px] pt-[92px] md:pt-[112px] ${BOTTOM_CLEARANCE}`}>
        <CheckoutClient />
      </Container>
    </main>
  );
}
