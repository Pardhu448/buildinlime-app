import { Logo } from "./Logo";

interface HeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export function Header({ className = "", children }: HeaderProps) {
  return (
    <header className={`bg-white border-b border-[#ac7f5e] ${className}`}>
      <div className="max-w-screen-2xl mx-auto px-6 py-2">
        <div className="flex items-center justify-between">
          <Logo size="md" orientation="horizontal" />
          {children && (
            <nav className="flex items-center gap-8">
              {children}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}