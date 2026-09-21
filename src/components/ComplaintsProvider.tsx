"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { fetchComplaint, isDatabaseOn, sendComplaint, settleComplaint } from "@/app/actions/shop";
import { useAccount } from "@/components/AccountProvider";
import {
  COMPLAINTS_STORAGE_KEY,
  decline,
  parseComplaints,
  raise,
  refund,
  serializeComplaints,
} from "@/lib/complaints";
import type { Complaint, ComplaintKind } from "@/lib/complaints";
import type { Kobo } from "@/lib/types";

/** A thin wrapper over the complaint rules in `lib/complaints.ts`. */

interface ComplaintsContextValue {
  readonly complaints: readonly Complaint[];
  readonly ready: boolean;
  readonly shared: boolean;
  /** Pull one order's complaint from the database, for a screen that needs it. */
  readonly load: (orderCode: string) => Promise<void>;
  readonly raiseComplaint: (args: {
    orderId: string;
    deliveredAt: number;
    kind: ComplaintKind;
    detail: string;
    lineKeys?: readonly string[];
  }) => Complaint;
  readonly refundComplaint: (id: string, amountKobo: Kobo, note: string) => void;
  readonly declineComplaint: (id: string, note: string) => void;
}

const ComplaintsContext = createContext<ComplaintsContextValue | null>(null);

export function ComplaintsProvider({ children }: { children: ReactNode }) {
  const [complaints, setComplaints] = useState<readonly Complaint[]>([]);
  const [ready, setReady] = useState(false);
  const [shared, setShared] = useState(false);
  const account = useAccount();

  const phone = account.phone ?? "";

  useEffect(() => {
    void (async () => {
      const on = await isDatabaseOn();
      setShared(on);

      if (!on) {
        try {
          setComplaints(parseComplaints(window.localStorage.getItem(COMPLAINTS_STORAGE_KEY)));
        } catch {
          // Blocked storage.
        }
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready || shared) return;
    try {
      window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, serializeComplaints(complaints));
    } catch {
      // Full or blocked.
    }
  }, [complaints, ready, shared]);

  /*
    Complaints are fetched per order rather than all at once. There is one per
    order at most, and the screens that show them are always looking at a
    particular order — loading every complaint in the shop to render one would
    be a list that grows forever for a page that shows a single row.
  */
  const load = useCallback(async (orderCode: string) => {
    if (!(await isDatabaseOn())) return;

    const found = await fetchComplaint(orderCode);
    setComplaints((prev) => {
      const without = prev.filter((c) => c.orderId !== orderCode);
      return found === null ? without : [found, ...without];
    });
  }, []);

  const raiseComplaint = useCallback(
    (args: { orderId: string; deliveredAt: number; kind: ComplaintKind; detail: string; lineKeys?: readonly string[] }) => {
      const complaint = raise({ ...args, at: Date.now() });
      setComplaints((prev) => [complaint, ...prev.filter((c) => c.orderId !== args.orderId)]);

      if (shared) {
        void sendComplaint({
          orderCode: args.orderId,
          phone,
          kind: args.kind,
          detail: args.detail,
          deliveredAt: args.deliveredAt,
          withinWindow: complaint.withinWindow,
        }).then(() => load(args.orderId));
      }

      return complaint;
    },
    [shared, phone, load],
  );

  const refundComplaint = useCallback(
    (id: string, amountKobo: Kobo, note: string) => {
      setComplaints((prev) => prev.map((c) => (c.id === id ? refund(c, amountKobo, Date.now(), note) : c)));

      if (shared) {
        const complaint = complaints.find((c) => c.id === id);
        if (complaint !== undefined) {
          // The refund goes to the order's customer, resolved server-side —
          // the shop is not signed in as them, and must not need to be.
          void settleComplaint({ orderCode: complaint.orderId, amountKobo, note }).then(() =>
            load(complaint.orderId),
          );
        }
      }
    },
    [shared, phone, complaints, load],
  );

  const declineComplaint = useCallback((id: string, note: string) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? decline(c, Date.now(), note) : c)));
  }, []);

  const value = useMemo(
    () => ({ complaints, ready, shared, load, raiseComplaint, refundComplaint, declineComplaint }),
    [complaints, ready, shared, load, raiseComplaint, refundComplaint, declineComplaint],
  );

  return <ComplaintsContext.Provider value={value}>{children}</ComplaintsContext.Provider>;
}

export function useComplaints(): ComplaintsContextValue {
  const ctx = useContext(ComplaintsContext);
  if (ctx === null) throw new Error("useComplaints must be used inside <ComplaintsProvider>");
  return ctx;
}
