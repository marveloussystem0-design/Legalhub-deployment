'use client';

import { signout } from "@/app/auth/actions";
import { LogOut } from "lucide-react";

export default function SignOutButton({ isCollapsed }: { isCollapsed?: boolean }) {
  return (
    <button
      onClick={() => signout()}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:text-red-700 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-all shadow-sm hover:shadow-md active:scale-[0.98] group ${
        isCollapsed ? 'w-12 px-0' : 'w-full'
      }`}
      title="Sign Out"
    >
      <LogOut className="h-4 w-4 text-gray-500 group-hover:text-red-600 transition-colors" />
      {!isCollapsed && <span>Sign Out</span>}
    </button>
  );
}
