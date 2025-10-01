import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BarChart3, Home, LineChart, Settings } from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const items = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/analytics", label: "Analytics", icon: LineChart },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-full w-full md:w-auto",
        "md:static fixed inset-y-0 left-0 z-40 transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
      aria-label="Sidebar"
    >
      <div className="flex h-16 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="size-8 rounded-md bg-brand" />
        <div className="text-lg font-bold">NovaBoard</div>
        <button
          className="md:hidden ml-auto text-sm px-2 py-1 rounded border border-sidebar-border"
          onClick={onClose}
          aria-label="Close menu"
        >
          Close
        </button>
      </div>
      <nav className="p-2 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-brand/10 text-brand-foreground border border-brand/30",
              )
            }
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto p-4 hidden md:block">
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} NovaBoard</div>
      </div>
    </aside>
  );
}
