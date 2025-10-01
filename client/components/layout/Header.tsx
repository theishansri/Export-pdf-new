import { Menu } from "lucide-react";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-3">
      <button
        className="md:hidden inline-flex items-center justify-center size-9 rounded-md border bg-card"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <div className="font-semibold">Dashboard</div>
      <div className="ml-auto flex items-center gap-3">
        <input
          placeholder="Search..."
          className="h-9 w-48 md:w-64 rounded-md border bg-background px-3 text-sm"
        />
        <div className="size-8 rounded-full bg-gradient-to-tr from-brand to-brand/60" />
      </div>
    </header>
  );
}
