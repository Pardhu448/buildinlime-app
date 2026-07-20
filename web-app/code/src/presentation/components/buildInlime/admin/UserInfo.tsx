import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, User, LogOut } from "lucide-react";
import { signOutAndDispose } from "%/infrastructure/auth/client";

interface UserInfoProps {
  initials: string;
  name: string;
}

export function UserInfo({ initials, name }: UserInfoProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOutAndDispose();
    // Hard redirect clears all in-memory Electric collection state,
    // preventing stale data from leaking to the next user.
    window.location.href = "/login";
  };

  return (
    <div className="p-4 border-b border-card-border relative">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 flex-1 hover:bg-icon-chip rounded p-1 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
            {initials}
          </div>
          <span className="font-medium text-foreground">{name}</span>
          <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />
        </button>
        {/* <button className="p-2 hover:bg-icon-chip rounded transition-colors">
          <Search className="w-4 h-4 text-muted-foreground" />
        </button>
        <button className="p-2 hover:bg-icon-chip rounded transition-colors">
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button> */}
      </div>

      {userMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
          <div className="absolute left-4 right-4 top-14 bg-white border border-gray-200 shadow-lg rounded-lg z-50 overflow-hidden">
            <Link
              to="/account"
              onClick={() => setUserMenuOpen(false)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 transition-colors text-left"
            >
              <User className="w-4 h-4 text-muted-foreground" />
              <span>Account</span>
            </Link>
            <div className="border-t border-gray-200" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
