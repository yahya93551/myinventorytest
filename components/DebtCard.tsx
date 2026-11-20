"use client";

import React, { useState, useMemo } from "react";
import Card from "./Card";
import Button from "./Button";
import { Plus, Trash, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

export interface DebtRecord {
  id: string;
  amount: number;
  amount_paid?: number;
  payments?: { id: string; amount: number; paid_at: string }[];
  date: string;
  note?: string;
  paid?: boolean;
}

export interface CustomerDebts {
  name: string;
  phone: string;
  debts: DebtRecord[];
}

interface DebtCardProps {
  customer: CustomerDebts;
  businessName?: string;
  onAdd: (phone: string, name?: string) => void;
  onDeleteDebt: (customerPhone: string, debtId: string) => void;
  onRecordPayment: (customerPhone: string, debtId: string, amount: number) => Promise<void>;
}

export default function DebtCard({ customer, businessName, onAdd, onDeleteDebt, onRecordPayment }: DebtCardProps) {
  const [open, setOpen] = useState(false);
  const [paymentAmounts, setPaymentAmounts] = useState<Record<string, string>>({});
  const [recordingDebtId, setRecordingDebtId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const business = businessName?.trim() || "Business";

  const whatsappUrl = (() => {
    const digits = customer.phone.replace(/\D/g, "");
    if (!digits) return "";

    const total = customer.debts.reduce((sum, d) => sum + (d.amount || 0), 0);
    const paidTotal = customer.debts.reduce((sum, d) => sum + (d.amount_paid ?? (d.paid ? d.amount || 0 : 0)), 0);
    const restTotal = total - paidTotal;

    const paidSentence =
      paidTotal > 0
        ? `Waxaa bixisay lacag dhan $${paidTotal.toFixed(2)}, `
        : "";

    const message = `${business}: Sida ku cad diiwaankayaga, wadarta alaabta aad qaadatay waa $${total.toFixed(2)}. ${paidSentence}waxaana wali kuugu harsan $${restTotal.toFixed(2)}. Fadlan bixi lacagta harsan waqtiga ugu dhow. Mahadsanid.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  })();

  const { total, paidTotal, restTotal } = useMemo(() => {
    const totals = customer.debts.reduce(
      (acc, d) => {
        const amount = d.amount || 0;
        acc.total += amount;
        acc.paidTotal += d.amount_paid ?? (d.paid ? amount : 0);
        return acc;
      },
      { total: 0, paidTotal: 0 }
    );

    return {
      total: totals.total,
      paidTotal: totals.paidTotal,
      restTotal: totals.total - totals.paidTotal,
    };
  }, [customer.debts]);

  const isFullySettled = restTotal <= 0.005;
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  oneMonthAgo.setHours(0, 0, 0, 0);
  const hasOverdueDebt = customer.debts.some((debt) => {
    if (debt.paid) return false;

    const debtDate = new Date(`${debt.date}T00:00:00`);
    return !Number.isNaN(debtDate.getTime()) && debtDate < oneMonthAgo;
  });
  const cardClassName = [
    open ? "flex flex-col relative z-20 w-[303px] overflow-visible" : "flex flex-col",
    isFullySettled
      ? "border-emerald-300/80 bg-emerald-50/70 shadow-[0_12px_30px_-18px_rgba(16,185,129,0.8)] ring-1 ring-emerald-200/70 dark:border-emerald-500/50 dark:bg-emerald-950/25 dark:ring-emerald-500/30"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleRecordPayment = async (debt: DebtRecord) => {
    const rawAmount = paymentAmounts[debt.id]?.trim() ?? "";
    const amount = Number(rawAmount);
    const amountPaid = debt.amount_paid ?? (debt.paid ? debt.amount : 0);
    const remainingCents = Math.max(0, Math.round((debt.amount - amountPaid) * 100));
    const amountCents = Math.round(amount * 100);

    if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(rawAmount) || !Number.isFinite(amount) || amount <= 0) {
      setPaymentError("Enter a payment amount greater than zero with up to two decimal places.");
      return;
    }
    if (amountCents > remainingCents) {
      setPaymentError(`Payment cannot exceed the remaining balance of $${(remainingCents / 100).toFixed(2)}.`);
      return;
    }

    setRecordingDebtId(debt.id);
    setPaymentError(null);
    try {
      await onRecordPayment(customer.phone, debt.id, amountCents / 100);
      setPaymentAmounts((current) => ({ ...current, [debt.id]: "" }));
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Unable to record debt payment.");
    } finally {
      setRecordingDebtId(null);
    }
  };

  return (
    <Card
      className={cardClassName}
      hover
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-theme-secondary">
            {customer.name || "—"}
            {hasOverdueDebt && (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-800 ring-1 ring-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-500/60"
                title="Unpaid debt older than one month"
                aria-label="Unpaid debt older than one month"
              >
                !
              </span>
            )}
          </div>
          <div className="font-medium">{customer.phone}</div>
          <div className="text-xs text-theme-secondary mt-1">{customer.debts.length} record(s)</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-theme-secondary">Total</div>
          <div className={`font-semibold text-lg ${isFullySettled ? "text-emerald-700" : ""}`}>
            {total.toFixed(2)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-theme-secondary">
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">Paid {paidTotal.toFixed(2)}</div>
            <div
              className={
                isFullySettled
                  ? "rounded-2xl border border-emerald-300 bg-emerald-100 px-3 py-2 text-emerald-800 shadow-sm"
                  : "rounded-2xl bg-slate-100 px-3 py-2 text-slate-900"
              }
            >
              {isFullySettled ? "Settled" : "Rest"} {restTotal.toFixed(2)}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 items-end min-w-30">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAdd(customer.phone, customer.name)}
              icon={<Plus />}
              aria-label="Add New Debt"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => whatsappUrl && window.open(whatsappUrl, "_blank")}
              disabled={!whatsappUrl}
              icon={<MessageCircle />}
              aria-label="Send Message"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Collapse details" : "View Details"}
            >
              {open ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-4 mb-1 divide-y divide-theme overflow-hidden rounded-b-xl">
          {paymentError && (
            <div role="alert" className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
              {paymentError}
            </div>
          )}
          {customer.debts.map((d) => (
            <div key={d.id} className="space-y-3 py-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{d.amount.toFixed(2)}</div>
                  <div className="text-xs text-theme-secondary">{d.date}</div>
                  <div className="text-xs text-theme-secondary">
                    Paid ${(d.amount_paid ?? (d.paid ? d.amount : 0)).toFixed(2)} · Remaining ${Math.max(0, d.amount - (d.amount_paid ?? (d.paid ? d.amount : 0))).toFixed(2)}
                  </div>
                  {d.payments?.map((payment) => (
                    <div key={payment.id} className="text-xs text-theme-secondary">
                      Payment ${payment.amount.toFixed(2)} · {new Date(payment.paid_at).toLocaleString()}
                    </div>
                  ))}
                  {d.note && <div className="text-xs mt-1">{d.note}</div>}
                </div>

                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this debt entry?")) {
                      onDeleteDebt(customer.phone, d.id);
                    }
                  }}
                  className="text-red-500 hover:text-red-600"
                  aria-label="Delete debt"
                >
                  <Trash />
                </button>
              </div>
              {!d.paid && (
                <div className="w-full space-y-2">
                  <label className="block text-xs text-theme-secondary" htmlFor={`payment-${d.id}`}>Payment amount</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id={`payment-${d.id}`}
                      type="number"
                      min="0.01"
                      max={Math.max(0, d.amount - (d.amount_paid ?? 0)).toFixed(2)}
                      step="0.01"
                      inputMode="decimal"
                      value={paymentAmounts[d.id] ?? ""}
                      onChange={(event) => {
                        setPaymentAmounts((current) => ({ ...current, [d.id]: event.target.value }));
                        setPaymentError(null);
                      }}
                      disabled={recordingDebtId !== null}
                      placeholder="0.00"
                      className="min-w-0 flex-1 rounded-xl border border-theme-stroke bg-theme-surface px-3 py-2 text-sm"
                    />
                    <Button
                      size="sm"
                      loading={recordingDebtId === d.id}
                      disabled={recordingDebtId !== null}
                      onClick={() => void handleRecordPayment(d)}
                    >
                      Record payment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
