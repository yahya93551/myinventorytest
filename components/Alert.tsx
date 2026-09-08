"use client";

import React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  closeable?: boolean;
  onClose?: () => void;
}

export default function Alert({
  variant = "info",
  title,
  closeable = true,
  onClose,
  children,
  className = "",
  ...props
}: AlertProps) {
  const [closed, setClosed] = React.useState(false);

  const handleClose = () => {
    setClosed(true);
    onClose?.();
  };

  if (closed) return null;

  const variantConfig = {
    success: {
      bg: "bg-emerald-50",
      border: "border-emerald-400",
      text: "text-emerald-900",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    error: {
      bg: "bg-rose-50",
      border: "border-rose-400",
      text: "text-rose-900",
      icon: <XCircle className="w-5 h-5" />,
    },
    warning: {
      bg: "bg-amber-50",
      border: "border-amber-400",
      text: "text-amber-900",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    info: {
      bg: "bg-sky-50",
      border: "border-sky-400",
      text: "text-sky-900",
      icon: <AlertCircle className="w-5 h-5" />,
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      className={`
        rounded-2xl border p-4 ${config.bg} ${config.border}
        flex items-start gap-3
        ${className}
      `}
      {...props}
    >
      <div className={`shrink-0 mt-0.5 ${config.text}`}>{config.icon}</div>

      <div className="flex-1 min-w-0">
        {title && (
          <p className={`font-semibold ${config.text}`}>{title}</p>
        )}
        <p className={`text-sm mt-1 ${config.text} opacity-90`}>{children}</p>
      </div>

      {closeable && (
        <button
          onClick={handleClose}
          className={`
            shrink-0 p-1 rounded-lg transition-colors
            hover:bg-white/10
            ${config.text}
          `}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
