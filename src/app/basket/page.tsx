import type { Metadata } from "next";

import { BOTTOM_CLEARANCE, Container } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { BasketClient } from "./BasketClient";

export const metadata: Metadata = { title: "Basket" };

export default function BasketPage() {
  return (
    <main>
      <PageBar title="Your basket" backHref="/shop" />
      <Container className={`pt-[92px] md:pt-[112px] pb-40 md:pb-16 ${BOTTOM_CLEARANCE.replace("pb-28 ", "")}`}>
        <BasketClient />
      </Container>
    </main>
  );
}
