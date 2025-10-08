import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  Legend,
  Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { initRUM, getRumBuffer } from "@/lib/rum";
import html2canvas from "html2canvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileDown, ChevronDown } from "lucide-react";
import html2pdf from "html2pdf.js";

// Import the worker directly
const PdfWorker = new Worker(
  new URL("@/workers/pdfWorker.js", import.meta.url),
  { type: "module" },
);

interface RumState {
  TTFB?: number;
  FCP?: number;
  LCP?: number;
  CLS?: number;
  FID?: number;
}

function useRUM() {
  const [state, setState] = useState<RumState>({});
  const [events, setEvents] = useState(() => getRumBuffer());

  useEffect(() => {
    initRUM();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as any;
      setState((s) => ({ ...s, [detail.name]: detail.value }));
      setEvents((prev) => [...prev, detail]);
    };
    addEventListener("rum:metric", handler as EventListener);
    return () => removeEventListener("rum:metric", handler as EventListener);
  }, []);

  return { state, events };
}

function generateSeries(days = 180) {
  const res: Array<{
    date: string;
    revenue: number;
    users: number;
    orders: number;
  }> = [];
  const start = new Date();
  start.setDate(start.getDate() - days);
  let rev = 1000;
  let users = 200;
  let orders = 80;
  for (let i = 0; i < days; i++) {
    start.setDate(start.getDate() + 1);
    rev += Math.sin(i / 7) * 60 + (Math.random() - 0.5) * 120;
    users += Math.cos(i / 9) * 8 + (Math.random() - 0.5) * 16;
    orders += Math.sin(i / 5) * 4 + (Math.random() - 0.5) * 10;
    res.push({
      date: start.toISOString().slice(0, 10),
      revenue: Math.max(100, Math.round(rev)),
      users: Math.max(0, Math.round(users)),
      orders: Math.max(0, Math.round(orders)),
    });
  }
  return res;
}

async function generateTableRows(n = 800) {
  try {
    const response = await fetch("/api/demo", {
      method: "GET",
      headers: {
        "Cache-Control": "no-cache", // Prevent caching issues
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch table rows: ${response.statusText}`);
    }

    const data = await response.json();
    return data.rows || []; // Return rows or an empty array if not present
  } catch (error) {
    console.error("Error in generateTableRows:", error);
    return []; // Return an empty array in case of an error
  }
}

function DashboardContent({
  description,
  series,
  rows,
  rum,
  rumEvents,
  reportRef,
}: {
  description: string;
  series: Array<{
    date: string;
    revenue: number;
    users: number;
    orders: number;
  }>;
  rows: Array<{
    id: number;
    customer: string;
    email: string;
    amount: number;
    status: string;
    date: string;
  }>;
  rum: RumState;
  rumEvents: { name: string; value: number }[];
  reportRef?: React.RefObject<HTMLDivElement>;
}) {
  const kpis = useMemo(() => {
    const totalRevenue = series.reduce((a, b) => a + b.revenue, 0);
    const totalOrders = series.reduce((a, b) => a + b.orders, 0);
    const avgUsers = Math.round(
      series.reduce((a, b) => a + b.users, 0) / series.length,
    );
    return { totalRevenue, totalOrders, avgUsers };
  }, [series]);

  const pieData = [
    { name: "Subscriptions", value: 45 },
    { name: "One-time", value: 35 },
    { name: "Enterprise", value: 20 },
  ];
  const pieColors = [
    "hsl(var(--brand))",
    "hsl(var(--primary))",
    "hsl(var(--accent))",
  ];

  return (
    <div className="p-4 md:p-6 space-y-6" ref={reportRef}>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Total Revenue</div>
          <div className="text-2xl font-bold mt-1">
            ${(kpis.totalRevenue / 1000).toFixed(1)}k
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.slice(-60)}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Orders</div>
          <div className="text-2xl font-bold mt-1">
            {kpis.totalOrders.toLocaleString()}
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.slice(-30)}>
                <Bar
                  dataKey="orders"
                  fill="hsl(var(--accent))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Active Users</div>
          <div className="text-2xl font-bold mt-1">
            {kpis.avgUsers.toLocaleString()}
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.slice(-45)}>
                <defs>
                  <linearGradient id="usersCard" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--brand))"
                  fill="url(#usersCard)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Total Revenue</div>
          <div className="text-2xl font-bold mt-1">
            ${(kpis.totalRevenue / 1000).toFixed(1)}k
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.slice(-60)}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Orders</div>
          <div className="text-2xl font-bold mt-1">
            {kpis.totalOrders.toLocaleString()}
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.slice(-30)}>
                <Bar
                  dataKey="orders"
                  fill="hsl(var(--accent))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Active Users</div>
          <div className="text-2xl font-bold mt-1">
            {kpis.avgUsers.toLocaleString()}
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.slice(-45)}>
                <defs>
                  <linearGradient id="usersCard" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--brand))"
                  fill="url(#usersCard)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Total Revenue</div>
          <div className="text-2xl font-bold mt-1">
            ${(kpis.totalRevenue / 1000).toFixed(1)}k
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.slice(-60)}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Orders</div>
          <div className="text-2xl font-bold mt-1">
            {kpis.totalOrders.toLocaleString()}
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series.slice(-30)}>
                <Bar
                  dataKey="orders"
                  fill="hsl(var(--accent))"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="text-sm text-muted-foreground">Active Users</div>
          <div className="text-2xl font-bold mt-1">
            {kpis.avgUsers.toLocaleString()}
          </div>
          <div className="h-20 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series.slice(-45)}>
                <defs>
                  <linearGradient id="usersCard" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--brand))"
                  fill="url(#usersCard)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border bg-card p-4 capture-me">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Revenue vs Users</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="areaUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" hide tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RTooltip
                  formatter={(v: any) =>
                    typeof v === "number" ? v.toLocaleString() : v
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#areaRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Users"
                  stroke="hsl(var(--brand))"
                  fill="url(#areaUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="font-semibold mb-3">Orders Breakdown</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieData} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border bg-card p-4 capture-me">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Revenue vs Users</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="areaUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" hide tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RTooltip
                  formatter={(v: any) =>
                    typeof v === "number" ? v.toLocaleString() : v
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#areaRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Users"
                  stroke="hsl(var(--brand))"
                  fill="url(#areaUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="font-semibold mb-3">Orders Breakdown</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieData} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-xl border bg-card p-4 capture-me">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">Revenue vs Users</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 8, right: 8 }}>
                <defs>
                  <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <linearGradient id="areaUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0.5}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--brand))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" hide tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RTooltip
                  formatter={(v: any) =>
                    typeof v === "number" ? v.toLocaleString() : v
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#areaRevenue)"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  name="Users"
                  stroke="hsl(var(--brand))"
                  fill="url(#areaUsers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 capture-me">
          <div className="font-semibold mb-3">Orders Breakdown</div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieData} label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="font-semibold mb-3">Transactions</div>
        <div className="border rounded-md overflow-hidden">
          <div className="max-h=[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="text-left p-2">ID</th>
                  <th className="text-left p-2">Customer</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-right p-2">Amount</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 &&
                  rows.map((r) => (
                    <tr key={r.id} className="odd:bg-muted/30">
                      <td className="p-2">{r.id}</td>
                      <td className="p-2">{r.customer}</td>
                      <td className="p-2 text-muted-foreground">{r.email}</td>
                      <td className="p-2 text-right">
                        ${r.amount.toLocaleString()}
                      </td>
                      <td className="p-2">
                        <span
                          className={
                            r.status === "paid"
                              ? "text-green-600"
                              : r.status === "pending"
                                ? "text-amber-600"
                                : "text-red-600"
                          }
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-2">{r.date}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Index() {
  const series = useMemo(() => generateSeries(210), []);
  const reportRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { state: rum, events: rumEvents } = useRUM();

  useEffect(() => {
    async function fetchRows() {
      const tableRows = await generateTableRows(1000);
      setRows(tableRows);
    }
    fetchRows();
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const handleDownloadhtml2pdf = () => {
    if (!reportRef.current) return;

    const opt = {
      margin: 0.5,
      filename: "dashboard-report.pdf",
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 3, useCORS: true },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
    };

    html2pdf().set(opt).from(reportRef.current).save();
  };
  const exportPDF = () => {
    window.print();
  };
  const handleDownloadjsPdf = async () => {
    try {
      const chartElements =
        document.querySelectorAll<HTMLElement>(".capture-me");
      const chartImages: string[] = [];

      // Capture charts as Base64 images
      for (const el of chartElements) {
        const canvas = await html2canvas(el, {
          scale: 2,
          backgroundColor: "#fff",
          useCORS: true,
        });
        chartImages.push(canvas.toDataURL("image/png"));
      }

      // Initialize the worker
      const worker = PdfWorker;

      // Send data to the worker
      worker.postMessage({ charts: chartImages, rows });

      // Listen for the worker's response
      worker.onmessage = (event) => {
        const { success, pdfBlob, error } = event.data;

        if (success) {
          // Create a download link for the PDF
          const url = window.URL.createObjectURL(pdfBlob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "dashboard-report.pdf";
          document.body.appendChild(link);
          link.click();
          link.remove();
        } else {
          console.error("Error generating PDF:", error);
        }

        // Terminate the worker
        worker.terminate();
      };
    } catch (err) {
      console.error("Error capturing charts:", err);
    }
  };

  const handleDownloadPdf = async (lib = "") => {
    console.log("Generating PDF with", lib || "default method");
    try {
      // Capture charts
      const captureElements =
        document.querySelectorAll<HTMLElement>(".capture-me");

      const chartImages: string[] = [];
      for (const el of captureElements) {
        const canvas = await html2canvas(el, {
          backgroundColor: "#fff", // Ensure a white background
          scale: 2, // Higher scale for better quality
          useCORS: true, // Allow cross-origin images
        });
        const dataUrl = canvas.toDataURL("image/png"); // Convert canvas to Base64 image
        chartImages.push(dataUrl);
      }

      // Capture the main content (HTML and CSS)
      const contentElement = document.querySelector(
        ".p-4.md\\:p-6",
      ) as HTMLElement;
      if (!contentElement) {
        alert("Content not found for PDF export");
        return;
      }

      // Clone and clean the content
      const clonedContent = contentElement.cloneNode(true) as HTMLElement;
      const printHiddenElements =
        clonedContent.querySelectorAll(".print\\:hidden");
      printHiddenElements.forEach((el) => el.remove());

      // Extract HTML content
      const htmlContent = clonedContent.innerHTML;

      // Extract CSS styles
      const rawCss = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("");
          } catch {
            return ""; // Ignore cross-origin stylesheets
          }
        })
        .join("\n");

      // Build the request payload
      const pdfRequest = {
        html: htmlContent,
        css: rawCss,
        charts: chartImages, // Base64-encoded chart images
        rows, // Table data
        title: "Dashboard Report",
      };

      // Send the data to the backend
      const response = await fetch(
        lib === "pdf-lib" ? "/api/export-pdf" : "/api/export-pdf-kit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pdfRequest),
        },
      );

      console.log("API response:", response);
      if (!response.ok) throw new Error("PDF generation failed");

      // Download the generated PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dashboard-report.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading PDF:", err);
    }
  };

  const handleDownloadPdfPuppeteer = async () => {
    try {
      // Select all chart elements with the class "capture-me"
      // const chartElements =
      //   document.querySelectorAll<HTMLElement>(".capture-me");
      // const chartImages: string[] = [];

      // Capture each chart as a Base64 image
      // for (const el of chartElements) {
      //   const canvas = await html2canvas(el, {
      //     scale: 2, // Better quality
      //     backgroundColor: "#fff", // White background
      //     useCORS: true,
      //   });
      //   chartImages.push(canvas.toDataURL("image/png"));
      // }

      // Get the main container (instead of whole page dump)
      const contentElement = document.querySelector(
        ".p-4.md\\:p-6",
      ) as HTMLElement;
      if (!contentElement) {
        alert("Content not found for PDF export");
        return;
      }

      // Clone and clean content
      const clonedContent = contentElement.cloneNode(true) as HTMLElement;
      const printHiddenElements =
        clonedContent.querySelectorAll(".print\\:hidden");
      printHiddenElements.forEach((el) => el.remove());

      // Extract HTML and CSS
      let htmlContent = clonedContent.innerHTML;
      const rawCss = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("");
          } catch {
            return "";
          }
        })
        .join("\n");

      // Build request payload
      const pdfRequest = {
        html: htmlContent,
        css: rawCss,
        // charts: chartImages,
        title: "RUM Dashboard Report",
        rows,
        format: "A4",
        orientation: "portrait",
        compress: true, // let backend compress charts
        quality: "medium", // medium balance between size & quality
      };

      // Call backend API
      const response = await fetch("/api/export-pdf-puppeteer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfRequest),
      });

      if (!response.ok) throw new Error("Puppeteer PDF generation failed");

      // Download PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RUM_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading Puppeteer PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Tabs defaultValue="overview">
        <div className="flex items-center justify-between mb-4 gap-1 print:hidden">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          {/* Dropdown for Export PDF */}
          <div className="relative">
            {/* Dropdown Trigger */}
            <button
              onClick={toggleDropdown}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              <FileDown className="mr-2" />
              Export PDF
              <ChevronDown className="ml-2" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={handleDownloadjsPdf}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export PDF jsPDF
                  </button>
                  <button
                    onClick={handleDownloadhtml2pdf}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export PDF html2pdf
                  </button>
                  <button
                    onClick={() => handleDownloadPdf("pdf-lib")}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export PDF pdf-lib
                  </button>
                  <button
                    onClick={handleDownloadPdfPuppeteer}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export PDF Puppeteer
                  </button>
                  <button
                    onClick={() => handleDownloadPdf("pdf-kit")}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Export PDF KIT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <TabsContent value="overview" className="mt-0">
          <DashboardContent
            description="Overview: Key business KPIs with revenue, orders, users, and trends."
            series={series}
            rows={rows}
            rum={rum}
            rumEvents={rumEvents}
            reportRef={reportRef}
          />
        </TabsContent>
        <TabsContent value="performance" className="mt-0">
          <DashboardContent
            description="Performance: In-depth charts with colored fills for visual comparison."
            series={series}
            rows={rows}
            rum={rum}
            rumEvents={rumEvents}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
