import React from "react";
import "./PremiumCheckmark.css";

interface PremiumCheckmarkProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PremiumCheckmark: React.FC<PremiumCheckmarkProps> = ({
  size = "md",
  className = "",
}) => {
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
  };

  const dimension = sizeMap[size];

  return (
    <svg
      className={`premium-checkmark premium-checkmark--${size} ${className}`}
      width={dimension}
      height={dimension}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Premium feature"
    >
      <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2" className="checkmark-circle-bg" />
      <circle cx="24" cy="24" r="20" fill="currentColor" className="checkmark-circle-fill" />
      <path d="M 16 24 L 21 29 L 32 18" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="checkmark-path" />
    </svg>
  );
};
