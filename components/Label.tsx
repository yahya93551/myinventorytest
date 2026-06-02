"use client";

import React from "react";

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  description?: string;
  tooltip?: string;
}

export default function Label({
  required = false,
  description,
  tooltip,
  children,
  className = "",
  ...props
}: LabelProps) {
  return (
    <div className="space-y-1">
      <label
        className={`text-label flex items-center gap-2 ${className}`}
        {...props}
      >
        {children}
        {required && <span className="text-red-400">*</span>}
        {tooltip && (
          <span
            className="text-theme-secondary text-xs cursor-help"
            title={tooltip}
          >
            ⓘ
          </span>
        )}
      </label>
      {description && (
        <p className="text-theme-secondary text-xs">{description}</p>
      )}
    </div>
  );
}
