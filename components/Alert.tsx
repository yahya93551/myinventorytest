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
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      text: "text-green-300",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      text: "text-red-300",
      icon: <XCircle className="w-5 h-5" />,
    },
    warning: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      text: "text-amber-300",
      icon: <AlertTriangle className="w-5 h-5" />,
    },
    info: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/30",
      text: "text-cyan-300",
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
        <p className="text-theme-secondary text-sm mt-1">{children}</p>
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
