"use client";

import React, { useState, useEffect } from "react";
import Button from "./Button";
import { X } from "lucide-react";

export interface DebtFormValues {
  name: string;
  phone: string;
  amount: string;
  date: string;
  note?: string;
}

interface DebtModalProps {
  open: boolean;
  initial?: Partial<DebtFormValues>;
  onClose: () => void;
  onSave: (vals: DebtFormValues) => void;
}

export default function DebtModal({ open, initial = {}, onClose, onSave }: DebtModalProps) {
  const [form, setForm] = useState<DebtFormValues>({
    name: initial.name || "",
    phone: initial.phone || "",
    amount: initial.amount || "",
    date: initial.date || new Date().toISOString().slice(0, 10),
    note: initial.note || "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || "",
        phone: initial?.phone || "",
        amount: initial?.amount || "",
        date: initial?.date || new Date().toISOString().slice(0, 10),
        note: initial?.note || "",
      });
    }
    // only run on open change to avoid loops when parent recreates `initial` object
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-4">
        <div className="rounded-2xl border border-theme bg-theme-card p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Add New Debt</h3>
            <button onClick={onClose} className="text-theme-secondary">
              <X />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="text-xs text-theme-secondary mb-1">Full name</div>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-theme p-2 bg-transparent"
                placeholder="Customer name"
              />
            </label>

            <label className="text-sm">
              <div className="text-xs text-theme-secondary mb-1">Phone</div>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-theme p-2 bg-transparent"
                placeholder="e.g. +1234567890"
              />
            </label>

            <label className="text-sm">
              <div className="text-xs text-theme-secondary mb-1">Amount</div>
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-theme p-2 bg-transparent"
                placeholder="0.00"
              />
            </label>

            <label className="text-sm">
              <div className="text-xs text-theme-secondary mb-1">Date</div>
              <input
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                type="date"
                className="w-full rounded-lg border border-theme p-2 bg-transparent"
              />
            </label>

            <label className="text-sm sm:col-span-2">
              <div className="text-xs text-theme-secondary mb-1">Note (optional)</div>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="w-full rounded-lg border border-theme p-2 bg-transparent"
                rows={3}
                placeholder="Optional note"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                // basic validation
                if (!form.phone || !form.amount) {
                  alert("Phone and amount are required");
                  return;
                }

                onSave({
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  amount: form.amount,
                  date: form.date,
                  note: form.note?.trim(),
                });
                onClose();
              }}
            >
              Save Debt
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
