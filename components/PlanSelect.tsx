import React, { useEffect, useRef, useState } from 'react';
import { SubscriptionPlan, getSubscriptionMonthlyFeeForPlan } from '@/lib/subscriptionPlans';

interface PlanSelectProps {
  value: SubscriptionPlan;
  onChange: (plan: SubscriptionPlan) => void;
  className?: string;
}

const LABELS: Record<SubscriptionPlan, string> = {
  basic: 'Basic',
  pro: 'Pro',
  team: 'Team',
};

export default function PlanSelect({ value, onChange, className }: PlanSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const plans: SubscriptionPlan[] = ['basic', 'pro', 'team'];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className={`${className ?? ''} text-left flex items-center justify-between`}
      >
        <span>
          {LABELS[value]} — ${getSubscriptionMonthlyFeeForPlan(value)} / month
        </span>
        <span className="ml-3 opacity-70">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute left-0 mt-2 w-full z-50 rounded-md border border-slate-200 bg-slate-800/90 p-1 text-sm text-slate-100 shadow-lg"
        >
          {plans.map((p) => (
            <li
              key={p}
              role="option"
              aria-selected={p === value}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={`cursor-pointer px-3 py-2 hover:bg-slate-700 ${p === value ? 'bg-slate-700 font-semibold' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span>{LABELS[p]}</span>
                <span className="opacity-80">${getSubscriptionMonthlyFeeForPlan(p)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
