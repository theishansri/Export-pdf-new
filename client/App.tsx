import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Placeholder from "./pages/Placeholder";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { useState } from "react";

const queryClient = new QueryClient();

const Shell = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="h-screen grid md:grid-cols-[30%_70%] bg-background">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex flex-col min-h-0">
        <Header onMenuClick={() => setOpen(true)} />
        <main className="min-h-0 flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/analytics" element={<Placeholder title="Analytics" />} />
            <Route path="/reports" element={<Placeholder title="Reports" />} />
            <Route path="/settings" element={<Placeholder title="Settings" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
