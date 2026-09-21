import type { Metadata } from "next";

import { Container, BOTTOM_CLEARANCE } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { AccountShell } from "../AccountClient";
import { WalletClient } from "./WalletClient";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return (
    <main>
      <PageBar title="Wallet" backHref="/account" />
      <Container className={`pt-[92px] md:pt-[106px] ${BOTTOM_CLEARANCE}`}>
        <AccountShell title="Wallet">
          <WalletClient />
        </AccountShell>
      </Container>
    </main>
  );
}
