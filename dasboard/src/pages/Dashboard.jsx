import React, { useEffect, useMemo, useState, useCallback, memo } from "react";
import { formatCurrency } from '../utils/currency';
import API from "../services/api";
import DashboardLayout from "../layout/DashboardLayout";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area
} from "recharts";

// Import the new bubble animation CSS
import "../styles/bubble-animation.css"; 

const COLORS = ["#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4", "#A78BFA", "#F43F5E", "#10B981", "#60A5FA", "#FBBF24"];

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [foodOrders, setFoodOrders] = useState([]);
  const [assignedServices, setAssignedServices] = useState([]);
  const [billings, setBillings] = useState([]);
  const [packages, setPackages] = useState([]);

  // ---------- Fetch Data Function ----------
  const fetchDashboardData = useCallback(async (showLoading = true) => {
      try {
      if (showLoading) {
        setLoading(true);
      }
        setErr(null); // Clear any previous errors
        
        // Fetch all endpoints with individual error handling to prevent complete failure
        // Reduced limits for better performance (pagination handles the rest)
        const results = await Promise.allSettled([
          API.get("/bookings?limit=500").catch(err => ({ error: err, data: { bookings: [] } })),
          API.get("/rooms?limit=500").catch(err => ({ error: err, data: [] })),
          API.get("/expenses?limit=500").catch(err => ({ error: err, data: [] })),
          API.get("/food-orders?limit=500").catch(err => ({ error: err, data: [] })),
          API.get("/services/assigned?limit=500").catch(err => ({ error: err, data: [] })),
          API.get("/bill/checkouts?limit=500").catch(err => ({ error: err, data: [] })),
          API.get("/packages?limit=500").catch(err => ({ error: err, data: [] })),
        ]);
        
        // Process results individually - allow partial failures
        if (results[0].status === 'fulfilled' && !results[0].value.error) {
          setBookings(Array.isArray(results[0].value.data?.bookings) ? results[0].value.data.bookings : []);
        } else {
          console.error("Failed to load bookings:", results[0].value?.error || results[0].reason);
          setBookings([]);
        }
        
        if (results[1].status === 'fulfilled' && !results[1].value.error) {
          setRooms(Array.isArray(results[1].value.data) ? results[1].value.data : []);
        } else {
          console.error("Failed to load rooms:", results[1].value?.error || results[1].reason);
          setRooms([]);
        }
        
        if (results[2].status === 'fulfilled' && !results[2].value.error) {
          setExpenses(Array.isArray(results[2].value.data) ? results[2].value.data : []);
        } else {
          console.error("Failed to load expenses:", results[2].value?.error || results[2].reason);
          setExpenses([]);
        }
        
        if (results[3].status === 'fulfilled' && !results[3].value.error) {
          setFoodOrders(Array.isArray(results[3].value.data) ? results[3].value.data : []);
        } else {
          console.error("Failed to load food orders:", results[3].value?.error || results[3].reason);
          setFoodOrders([]);
        }
        
        if (results[4].status === 'fulfilled' && !results[4].value.error) {
          setAssignedServices(Array.isArray(results[4].value.data) ? results[4].value.data : []);
        } else {
          console.error("Failed to load services:", results[4].value?.error || results[4].reason);
          setAssignedServices([]);
        }
        
        if (results[5].status === 'fulfilled' && !results[5].value.error) {
          setBillings(Array.isArray(results[5].value.data) ? results[5].value.data : []);
        } else {
          console.error("Failed to load billings:", results[5].value?.error || results[5].reason);
          setBillings([]);
        }
        
        if (results[6].status === 'fulfilled' && !results[6].value.error) {
          setPackages(Array.isArray(results[6].value.data) ? results[6].value.data : []);
        } else {
          console.error("Failed to load packages:", results[6].value?.error || results[6].reason);
          setPackages([]);
        }
        
        // Set error message only if all requests failed
        const allFailed = results.every(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error));
        if (allFailed) {
          setErr("Failed to load dashboard data. Please check your connection and try again.");
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
        setErr(e?.response?.data?.detail || "Failed to load dashboard data");
      } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // ---------- Initial Data Fetch and Auto-Refresh ----------
  useEffect(() => {
    let mounted = true;
    
    // Initial fetch with loading indicator
    fetchDashboardData(true);
    
    // Set up auto-refresh every 5 minutes (300,000 milliseconds)
    const refreshInterval = setInterval(() => {
      if (mounted) {
        // Refresh without showing loading indicator for smoother UX
        fetchDashboardData(false);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      mounted = false;
      clearInterval(refreshInterval);
    };
  }, [fetchDashboardData]);

  // ... (rest of the useMemo and helper functions)
  const safeDate = useCallback((d) => (d ? new Date(d) : null), []);
  const fmtCurrency = useCallback((n, decimals = 0) => formatCurrency(Number(n || 0), true, decimals), []);
  const roomCounts = useMemo(() => {
    const total = rooms.length;
    // Room statuses are: "Available", "Occupied", "Maintenance"
    const occupied = rooms.filter(r => {
      const status = (r.status || r.current_status || "").toLowerCase();
      return status.includes("occupied") || status.includes("booked");
    }).length;
    const available = rooms.filter(r => {
      const status = (r.status || "").toLowerCase();
      return status.includes("avail");
    }).length;
    const maintenance = rooms.filter(r => {
      const status = (r.status || "").toLowerCase();
      return status.includes("maintenance") || status.includes("maintain");
    }).length;
    // Ensure counts add up correctly
    const calculatedMaintenance = Math.max(0, total - occupied - available);
    return { 
      total, 
      occupied, 
      available, 
      maintenance: maintenance > 0 ? maintenance : calculatedMaintenance 
    };
  }, [rooms]);
  const revenue = useMemo(() => {
    const total = billings.reduce((s, b) => s + Number(b.grand_total || 0), 0);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let today = 0, month = 0;
    billings.forEach(b => {
      // Use checkout_date if available, otherwise fallback to created_at
      const dateToUse = b.checkout_date || b.created_at;
      const d = safeDate(dateToUse);
      if (!d) return;
      const ds = d.toISOString().slice(0, 10);
      if (ds === todayStr) today += Number(b.grand_total || 0);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (mk === thisMonthKey) month += Number(b.grand_total || 0);
    });
    return { total, today, month };
  }, [billings]);
  const expenseAgg = useMemo(() => {
    const total = expenses.reduce((s, e) => s + Number(e.amount || e.charges || 0), 0);
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let month = 0;
    expenses.forEach(e => {
      const d = safeDate(e.created_at);
      if (!d) return;
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (mk === thisMonthKey) month += Number(e.amount || e.charges || 0);
    });
    return { total, month };
  }, [expenses]);
  const bookingCounts = useMemo(() => {
    const total = bookings.length;
    const cancelled = bookings.filter(b => {
      const status = (b.status || "").toLowerCase();
      return status.includes("cancel");
    }).length;
    // Active bookings: exclude cancelled and checked-out
    const active = bookings.filter(b => {
      const status = (b.status || "").toLowerCase();
      return !status.includes("cancel") && 
             !status.includes("checked-out") && 
             !status.includes("checked_out");
    }).length;
    return { total, active, cancelled };
  }, [bookings]);
  const revenueSeries = useMemo(() => {
    const map = new Map();
    billings.forEach(b => {
      const d = safeDate(b.created_at);
      if (!d) return;
      const key = d.toISOString().slice(0, 10);
      map.set(key, (map.get(key) || 0) + Number(b.grand_total || 0));
    });
    const arr = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      arr.push({ date: key.slice(5), revenue: map.get(key) || 0 });
    }
    return arr;
  }, [billings]);
  const expensesByType = useMemo(() => {
    const map = new Map();
    expenses.forEach(e => {
      const k = (e.type || e.category || "Other");
      map.set(k, (map.get(k) || 0) + Number(e.amount || e.charges || 0));
    });
    return Array.from(map, ([type, amount]) => ({ type, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [expenses]);
  const paymentMethodPie = useMemo(() => {
    const map = new Map();
    billings.forEach(b => {
      const k = (b.payment_method || "other").replace("_", " ").toUpperCase();
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [billings]);
  const foodTypePie = useMemo(() => {
    const map = new Map();
    foodOrders.forEach(o => {
      const k = (o.type || o.category || "Other");
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [foodOrders]);
  const occupancyDonut = useMemo(() => ([
    { name: "Occupied", value: roomCounts.occupied },
    { name: "Available", value: roomCounts.available },
    { name: "Maintenance", value: roomCounts.maintenance },
  ]), [roomCounts]);
  const servicesStatus = useMemo(() => {
    const map = new Map();
    assignedServices.forEach(s => {
      const k = (s.status || s.assigned_status || "pending").toUpperCase();
      map.set(k, (map.get(k) || 0) + 1);
    });
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [assignedServices]);
  const packagesByBookings = useMemo(() => {
    const pkgMap = new Map(packages.map(p => [p.id, p.title]));
    const bookingCounts = bookings.reduce((acc, booking) => {
      const pkgId = booking.package?.id || booking.package_id;
      const pkgTitle = pkgMap.get(pkgId) || "Unknown";
      acc[pkgTitle] = (acc[pkgTitle] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(bookingCounts).map(([name, count]) => ({ name, count }));
  }, [bookings, packages]);
  const latestBookings = useMemo(() => {
    return [...bookings]
      .sort((a, b) => new Date(b.created_at || b.check_in) - new Date(a.created_at || a.check_in))
      .slice(0, 10);
  }, [bookings]);
  const latestBillings = useMemo(() => {
    return [...billings]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }, [billings]);
  const latestFood = useMemo(() => {
    return [...foodOrders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }, [foodOrders]);
  const latestPackages = useMemo(() => {
    return [...packages]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
  }, [packages]);

  // ---------- UI ----------
  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-56" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Show error message if there's an error
  if (err) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Dashboard</h2>
            <p className="text-red-600">{err}</p>
            <button 
              onClick={() => { setErr(null); fetchDashboardData(); }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* The new bubble animation background container */}
      <div className="bubbles-container">
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
        <li></li>
      </div>

      <div className="relative max-w-[1400px] mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800">Orchid Resort Admin Dashboard</h1>
            <p className="text-sm sm:text-base text-gray-500">Overview of bookings, rooms, revenue, expenses & operations</p>
          </div>
          <div className="text-xs sm:text-sm text-gray-500">
            Last updated: {new Date().toLocaleString()}
          </div>
        </header>

        {/* KPI Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-4">
          <KPICard label="Total Revenue" value={fmtCurrency(revenue.total)} sub="All time" />
          <KPICard label="Today Revenue" value={fmtCurrency(revenue.today)} sub="Today" />
          <KPICard label="This Month Revenue" value={fmtCurrency(revenue.month)} sub="Month" />
          <KPICard label="Total Expenses" value={fmtCurrency(expenseAgg.total)} sub="All time" />
          <KPICard label="Bookings (Active)" value={`${bookingCounts.active}`} sub={`Cancelled: ${bookingCounts.cancelled}`} />
          <KPICard label="Total Packages" value={packages.length} sub="All time" />
          <KPICard label="Rooms" value={`${roomCounts.occupied}/${roomCounts.total}`} sub="Occupied / Total" />
        </section>

        {/* Charts Row 1 */}
        <section className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <Card title="Revenue (Last 14 days)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="#6366F1" fillOpacity={1} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Payment Methods">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentMethodPie} dataKey="value" nameKey="name" outerRadius={90} label>
                    {paymentMethodPie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Room Occupancy">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={occupancyDonut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>
                    {occupancyDonut.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Charts Row 2 */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card title="Expenses by Type (Top 6)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expensesByType} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#22C55E" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Food Orders by Type">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={foodTypePie} dataKey="value" nameKey="name" outerRadius={90} label>
                    {foodTypePie.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Service Requests Status">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={servicesStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                    {servicesStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i + 6) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Charts Row 3 (New) */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="Packages by Booking">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={packagesByBookings} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#A78BFA" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        {/* Tables */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          <Card title="Latest Bookings">
            <div className="overflow-x-auto w-full -mx-2 sm:mx-0">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <Th>Guest</Th>
                    <Th className="hidden sm:table-cell">Room</Th>
                    <Th className="hidden lg:table-cell">Check-in</Th>
                    <Th className="hidden lg:table-cell">Check-out</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {latestBookings.map((b) => (
                    <tr key={b.id} className="border-t hover:bg-gray-50">
                      <Td className="text-xs sm:text-sm">{b.guest_name || b.guest || "-"}</Td>
                      <Td className="text-xs sm:text-sm hidden sm:table-cell">{b.room?.number ? `#${b.room.number}${b.room?.type ? ` (${b.room.type})` : ''}` : (b.room_number || "-")}</Td>
                      <Td className="text-xs sm:text-sm hidden lg:table-cell">{b.check_in}</Td>
                      <Td className="text-xs sm:text-sm hidden lg:table-cell">{b.check_out}</Td>
                      <Td>
                        <span className={`px-2 py-1 text-xs rounded font-semibold ${
                          String(b.status || "").toLowerCase().includes("cancel")
                            ? "bg-red-100 text-red-600"
                            : "bg-green-100 text-green-700"
                          }`}>
                          {b.status}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Recent Payments (Billing)">
            <div className="overflow-x-auto w-full -mx-2 sm:mx-0">
              <table className="min-w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <Th>Guest</Th>
                    <Th className="hidden sm:table-cell">Room</Th>
                    <Th className="hidden md:table-cell">Method</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="hidden lg:table-cell">Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {latestBillings.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <Td className="text-xs sm:text-sm">{c.guest_name || "-"}</Td>
                      <Td className="text-xs sm:text-sm hidden sm:table-cell">{c.room_number || "-"}</Td>
                      <Td className="text-xs sm:text-sm capitalize hidden md:table-cell">{String(c.payment_method || "").replace("_", " ")}</Td>
                      <Td className="uppercase">
                        <span className={`px-2 py-1 text-xs rounded font-semibold ${
                          String(c.payment_status || "").toLowerCase() === "paid"
                            ? "bg-green-100 text-green-700"
                            : String(c.payment_status || "").toLowerCase() === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}>
                          {c.payment_status}
                        </span>
                      </Td>
                      <Td className="text-right font-medium text-xs sm:text-sm">{fmtCurrency(c.grand_total)}</Td>
                      <Td className="text-xs sm:text-sm hidden lg:table-cell">{safeDate(c.created_at)?.toLocaleDateString() || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
        
        {/* New tables section */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="Latest Packages">
            <div className="overflow-x-auto w-full">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <Th>Title</Th>
                    <Th>Price</Th>
                    <Th>Images</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {latestPackages.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-gray-50">
                      <Td>{p.title || "-"}</Td>
                      <Td>{fmtCurrency(p.price)}</Td>
                      <Td>{p.images?.length || 0}</Td>
                      <Td>{safeDate(p.created_at)?.toLocaleString() || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          
          <Card title="Recent Food Orders">
            <div className="overflow-x-auto w-full">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <Th>Type</Th>
                    <Th>Items</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {latestFood.map((o, idx) => (
                    <tr key={o.id || idx} className="border-t hover:bg-gray-50">
                      <Td>{o.type || o.category || "-"}</Td>
                      <Td>{Array.isArray(o.items) ? o.items.length : (o.quantity || "-")}</Td>
                      <Td>
                        <span className={`px-2 py-1 text-xs rounded font-semibold ${
                          String(o.status || "").toLowerCase().includes("cancel")
                            ? "bg-red-100 text-red-600"
                            : "bg-blue-100 text-blue-700"
                          }`}>
                          {o.status || "NEW"}
                        </span>
                      </Td>
                      <Td className="text-right">{fmtCurrency(o.amount || o.total || 0)}</Td>
                      <Td>{safeDate(o.created_at)?.toLocaleString() || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card title="Quick Expense Peek">
            <div className="overflow-x-auto w-full">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-700">
                    <Th>Type</Th>
                    <Th>Note</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Created</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...expenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8).map((e, i) => (
                    <tr key={e.id || i} className="border-t hover:bg-gray-50">
                      <Td>{e.type || e.category || "-"}</Td>
                      <Td className="truncate max-w-[260px]" title={e.note || e.description || ""}>
                        {e.note || e.description || "-"}
                      </Td>
                      <Td className="text-right">{fmtCurrency(e.amount || e.charges || 0)}</Td>
                      <Td>{safeDate(e.created_at)?.toLocaleString() || "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
};

/* ---------- Small UI bits ---------- */
const KPICard = memo(({ label, value, sub }) => (
  <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4">
    <div className="text-xs uppercase tracking-wide text-gray-500 truncate">{label}</div>
    <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mt-1 truncate">{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-1 truncate">{sub}</div>}
  </div>
));
KPICard.displayName = 'KPICard';

const Card = memo(({ title, children }) => (
  <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
    <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4">{title}</h2>
    {children}
  </div>
));
Card.displayName = 'Card';

const Th = memo(({ children, className = "" }) => (
  <th className={`px-2 sm:px-3 py-2 text-left text-xs sm:text-sm font-semibold ${className}`}>{children}</th>
));
Th.displayName = 'Th';

const Td = memo(({ children, className = "" }) => (
  <td className={`px-2 sm:px-3 py-2 text-xs sm:text-sm ${className}`}>{children}</td>
));
Td.displayName = 'Td';

export default Dashboard;