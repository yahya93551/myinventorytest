"use client";

import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-cyan-500 hover:bg-cyan-600 text-white shadow-sm shadow-cyan-500/20",
  secondary: "bg-slate-700 hover:bg-slate-600 text-white shadow-sm shadow-slate-900/15",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-500/20",
  ghost: "bg-transparent hover:bg-white/10 text-slate-300 border border-slate-600/50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2 text-base rounded-xl",
  lg: "px-6 py-3 text-lg rounded-xl",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={loading || disabled}
      className={`
        flex items-center gap-2 font-medium
        transition-all duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? "w-full justify-center" : ""}
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500
      `}
      {...props}
    >
      {loading ? <span className="animate-spin">⌛</span> : icon}
      {children}
    </button>
  );
}
