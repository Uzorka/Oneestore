"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

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

  useEffect(() => {
    try {
      setComplaints(parseComplaints(window.localStorage.getItem(COMPLAINTS_STORAGE_KEY)));
    } catch {
      // Blocked storage.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, serializeComplaints(complaints));
    } catch {
      // Full or blocked.
    }
  }, [complaints, ready]);

  const raiseComplaint = useCallback(
    (args: { orderId: string; deliveredAt: number; kind: ComplaintKind; detail: string; lineKeys?: readonly string[] }) => {
      const complaint = raise({ ...args, at: Date.now() });
      setComplaints((prev) => [complaint, ...prev.filter((c) => c.orderId !== args.orderId)]);
      return complaint;
    },
    [],
  );

  const refundComplaint = useCallback((id: string, amountKobo: Kobo, note: string) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? refund(c, amountKobo, Date.now(), note) : c)));
  }, []);

  const declineComplaint = useCallback((id: string, note: string) => {
    setComplaints((prev) => prev.map((c) => (c.id === id ? decline(c, Date.now(), note) : c)));
  }, []);

  const value = useMemo(
    () => ({ complaints, ready, raiseComplaint, refundComplaint, declineComplaint }),
    [complaints, ready, raiseComplaint, refundComplaint, declineComplaint],
  );

  return <ComplaintsContext.Provider value={value}>{children}</ComplaintsContext.Provider>;
}

export function useComplaints(): ComplaintsContextValue {
  const ctx = useContext(ComplaintsContext);
  if (ctx === null) throw new Error("useComplaints must be used inside <ComplaintsProvider>");
  return ctx;
}
