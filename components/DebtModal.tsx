"use client";

import React, { useState, useEffect } from "react";
import Button from "./Button";
import { X } from "lucide-react";
import { countryOptions, isPhoneNumber, normalizePhoneNumber, splitPhoneNumber } from "@/lib/auth";

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
  const [countryCode, setCountryCode] = useState("+252");
  const [form, setForm] = useState<DebtFormValues>({
    name: initial.name || "",
    phone: initial.phone || "",
    amount: initial.amount || "",
    date: initial.date || new Date().toISOString().slice(0, 10),
    note: initial.note || "",
  });

  useEffect(() => {
    if (open) {
      const phoneParts = initial?.phone ? splitPhoneNumber(initial.phone) : { countryCode: "+252", phone: "" };
      setCountryCode(phoneParts.countryCode);
      setForm({
        name: initial?.name || "",
        phone: phoneParts.phone,
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
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="w-24 rounded-lg border border-theme p-2 bg-slate-950 text-slate-100"
                >
                  {countryOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.flag} {option.code}
                    </option>
                  ))}
                </select>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="flex-1 rounded-lg border border-theme p-2 bg-transparent"
                  placeholder="Phone number"
                  inputMode="tel"
                />
              </div>
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
                const rawPhone = form.phone.trim();
                const phoneInput = rawPhone.startsWith("+") ? rawPhone : `${countryCode}${rawPhone}`;
                const normalizedPhone = normalizePhoneNumber(phoneInput);

                if (!rawPhone || !form.amount) {
                  alert("Phone and amount are required");
                  return;
                }

                if (!isPhoneNumber(normalizedPhone)) {
                  alert("Please enter a valid phone number.");
                  return;
                }

                onSave({
                  name: form.name.trim(),
                  phone: normalizedPhone,
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
