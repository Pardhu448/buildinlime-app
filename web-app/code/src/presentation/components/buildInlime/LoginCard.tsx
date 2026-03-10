import type { ReactNode } from "react";

interface LoginCardProps {
  children: ReactNode;
}

export function LoginCard({ children }: LoginCardProps) {
  return <div className="bg-white rounded-[16px] border border-[#e5ddd5] shadow-[0px_8px_40px_0px_rgba(151,102,35,0.1)]">{children}</div>;
}
