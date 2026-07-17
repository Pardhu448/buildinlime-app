import type { ReactNode } from "react";

interface LoginCardProps {
  children: ReactNode;
}

export function LoginCard({ children }: LoginCardProps) {
  return <div className="bg-white rounded-[16px] border border-card-border-subtle shadow-card">{children}</div>;
}
