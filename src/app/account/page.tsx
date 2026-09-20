import type { Metadata } from "next";

import { Container, BOTTOM_CLEARANCE } from "@/components/Container";
import { PageBar } from "@/components/TopBar";

import { AccountDetails, AccountShell } from "./AccountClient";

export const metadata: Metadata = { title: "Your account" };

export default function AccountPage() {
  return (
    <main>
      <PageBar title="Your account" backHref="/" />
      <Container className={`pt-[92px] md:pt-[106px] ${BOTTOM_CLEARANCE}`}>
        <AccountShell title="Your details">
          <AccountDetails />
        </AccountShell>
      </Container>
    </main>
  );
}
