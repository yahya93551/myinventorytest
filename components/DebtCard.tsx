"use client";

import React, { useState, useMemo } from "react";
import Card from "./Card";
import Button from "./Button";
import { Plus, Trash, Check, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

export interface DebtRecord {
  id: string;
  amount: number;
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
  onMarkPaid: (customerPhone: string, debtId: string) => void;
}

export default function DebtCard({ customer, businessName, onAdd, onDeleteDebt, onMarkPaid }: DebtCardProps) {
  const [open, setOpen] = useState(false);
  const business = businessName?.trim() || "Business";

  const whatsappUrl = (() => {
    const digits = customer.phone.replace(/\D/g, "");
    if (!digits) return "";

    const total = customer.debts.reduce((sum, d) => sum + (d.amount || 0), 0);
    const paidTotal = customer.debts.reduce((sum, d) => sum + (d.paid ? d.amount || 0 : 0), 0);
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
        if (d.paid) {
          acc.paidTotal += amount;
        }
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

  return (
    <Card className="flex flex-col" hover>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-theme-secondary">{customer.name || "—"}</div>
          <div className="font-medium">{customer.phone}</div>
          <div className="text-xs text-theme-secondary mt-1">{customer.debts.length} record(s)</div>
        </div>

        <div className="text-right">
          <div className="text-sm text-theme-secondary">Total</div>
          <div className="font-semibold text-lg">{total.toFixed(2)}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-theme-secondary">
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">Paid {paidTotal.toFixed(2)}</div>
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-slate-900">Rest {restTotal.toFixed(2)}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 items-center justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onAdd(customer.phone, customer.name)}
              icon={<Plus />}
              className="text-xs px-3 py-2"
            >
              Add New Debt
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => whatsappUrl && window.open(whatsappUrl, "_blank")}
              disabled={!whatsappUrl}
              icon={<MessageCircle />}
              className="w-fit text-xs px-3 py-2"
            >
              Send Message
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(!open)}
              className="text-xs px-3 py-2"
            >
              {open ? <ChevronUp /> : <ChevronDown />} {open ? "Collapse" : "View Details"}
            </Button>
          </div>
        </div>
      </div>

      {open && (
        <div className="mt-4 divide-y divide-theme">
          {customer.debts.map((d) => (
            <div key={d.id} className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-medium">{d.amount.toFixed(2)}</div>
                <div className="text-xs text-theme-secondary">{d.date}</div>
                {d.note && <div className="text-xs mt-1">{d.note}</div>}
              </div>

              <div className="flex items-start gap-2">
                {d.paid ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                    Paid
                  </span>
                ) : (
                  <button
                    onClick={() => onMarkPaid(customer.phone, d.id)}
                    className="text-emerald-500 hover:text-emerald-600"
                    aria-label="Mark debt as paid"
                  >
                    <Check />
                  </button>
                )}

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
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
