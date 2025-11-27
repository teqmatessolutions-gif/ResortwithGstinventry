import React, { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import API from "../services/api";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { DollarSign, Users, Calendar, BedDouble, Briefcase, Package, Utensils, ConciergeBell, CheckCircle, ShoppingCart, TrendingUp } from "lucide-react";
import CountUp from "react-countup";
import { motion } from "framer-motion";
import { useInfiniteScroll } from "./useInfiniteScroll";

// --- Helper Components ---

const KpiCard = ({ title, value, icon, prefix = "", suffix = "", loading }) => {
  if (loading) {
    return <div className="bg-gray-200 h-24 rounded-2xl animate-pulse"></div>;
  }
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg p-5 flex items-center gap-4 hover:shadow-xl transition duration-300 transform hover:-translate-y-1"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {icon}
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <CountUp end={value} prefix={prefix} suffix={suffix} duration={1.5} className="text-3xl font-bold text-gray-800" />
      </div>
    </motion.div>
  );
};

const SectionCard = ({ title, icon, children, loading, className = "" }) => {
  if (loading) {
    return <div className="bg-gray-200 h-96 rounded-2xl animate-pulse"></div>;
  }
  return (
    <motion.div
      className={`bg-white rounded-2xl shadow-xl p-6 flex flex-col ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <div className="flex items-center mb-4 border-b border-gray-200 pb-3">
        {icon}
        <h2 className="text-xl font-bold text-gray-800 ml-3">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
};

const DetailTable = ({ title, headers, data, loading, hasMore, loadMore, isSubmitting }) => {
  if (loading) {
    return <div className="bg-gray-200 h-64 rounded-2xl animate-pulse"></div>;
  }
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-700 mb-4">{title}</h3>
      <div className="overflow-x-auto max-h-80">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              {headers.map((h) => <th key={h} className="px-4 py-2 text-left font-semibold text-gray-600">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.length > 0 ? data.map((row, i) => (
              <tr key={`${title}-${i}`} className="hover:bg-gray-50 transition-colors">
                {headers.map((h) => <td key={`${title}-${i}-${h}`} className="px-4 py-3 whitespace-nowrap">{row[h.toLowerCase().replace(/ /g, '_')] || 'N/A'}</td>)}
              </tr>
            )) : (
              <tr><td colSpan={headers.length} className="text-center py-10 text-gray-500">No data available.</td></tr>
            )}
          </tbody>
        </table>
        {hasMore && (
          <div ref={loadMore} className="text-center p-4">
            {isSubmitting && <span className="text-indigo-600">Loading...</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const CHART_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

export default function ReportsDashboard() {
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("all"); // 'day', 'week', 'month', 'all'
  const [kpiData, setKpiData] = useState({});
  const [roomMap, setRoomMap] = useState({}); // room_id -> number
  const [chartData, setChartData] = useState({ revenue_breakdown: [], weekly_performance: [] });
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detailedData, setDetailedData] = useState({
    roomBookings: [],
    packageBookings: [],
    foodOrders: [],
    expenses: [],
    employees: [],
  });
  const [pagination, setPagination] = useState({
    roomBookings: { skip: 0, hasMore: true },
    packageBookings: { skip: 0, hasMore: true },
    foodOrders: { skip: 0, hasMore: true },
    expenses: { skip: 0, hasMore: true },
    employees: { skip: 0, hasMore: true },
  });
  const PAGE_LIMIT = 10;

  const roomBookingsRef = useInfiniteScroll(() => loadMore('roomBookings'), pagination.roomBookings.hasMore, isSubmitting);
  const packageBookingsRef = useInfiniteScroll(() => loadMore('packageBookings'), pagination.packageBookings.hasMore, isSubmitting);
  const foodOrdersRef = useInfiniteScroll(() => loadMore('foodOrders'), pagination.foodOrders.hasMore, isSubmitting);
  const expensesRef = useInfiniteScroll(() => loadMore('expenses'), pagination.expenses.hasMore, isSubmitting);
  const employeesRef = useInfiniteScroll(() => loadMore('employees'), pagination.employees.hasMore, isSubmitting);
  useEffect(() => {
    const fetchKpis = async () => {
      try {
        setLoading(true);
        const response = await API.get(`/dashboard/summary?period=${period}`);
        setKpiData(response.data);
      } catch (err) {
        console.error("Failed to fetch KPI data:", err);
        setError("Failed to load dashboard data. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, [period]);

  useEffect(() => {
    const fetchCharts = async () => {
      try {
        setChartLoading(true);
        const response = await API.get("/dashboard/charts");
        setChartData(response.data);
      } catch (err) {
        console.error("Failed to fetch chart data:", err);
        // Non-critical error, so we don't set the main error state
      } finally {
        setChartLoading(false);
      }
    };
    fetchCharts();
  }, []); // Remove period dependency to prevent re-fetching charts

  useEffect(() => {
    const fetchDetailedData = async () => {
      try {
        setDetailsLoading(true);
        // Reset pagination on period change
        setPagination({
            roomBookings: { skip: 0, hasMore: true },
            packageBookings: { skip: 0, hasMore: true },
            foodOrders: { skip: 0, hasMore: true },
            expenses: { skip: 0, hasMore: true },
            employees: { skip: 0, hasMore: true },
        });

        const fromDate = getPeriodDate(period);
        const params = new URLSearchParams();
        if (fromDate) params.append('from_date', fromDate);
        params.append('skip', 0);
        params.append('limit', PAGE_LIMIT);
        const queryString = params.toString();

        // Only fetch data that's actually needed, reduce API calls
        // Try richer /reports endpoints first; gracefully fall back to base endpoints in production
        const roomBookingsReq = API.get(`/bookings?${queryString}`);
        const packageBookingsReq = API.get(`/reports/package-bookings?${queryString}`).catch(() => ({ data: [] }));
        const foodOrdersReq = API.get(`/reports/food-orders?${queryString}`).catch(() => API.get(`/food-orders?${queryString}`));
        const expensesReq = API.get(`/reports/expenses?${queryString}`).catch(() => API.get(`/expenses?${queryString}`));
        const employeesReq = API.get(`/employees?${queryString}`);
        const roomsReq = API.get(`/rooms?skip=0&limit=1000`).catch(() => ({ data: [] }));
        const [roomBookingsRes, packageBookingsRes, foodOrdersRes, expensesRes, employeesRes, roomsRes] = await Promise.all([
          roomBookingsReq, packageBookingsReq, foodOrdersReq, expensesReq, employeesReq, roomsReq
        ]);

        // Build room map for food orders display if only room_id is present
        const map = {};
        (roomsRes.data || []).forEach(r => { map[r.id] = r.number; });
        setRoomMap(map);
        
        // Use a single state update to prevent blinking
        // Normalize food orders to include room_number and created_at if possible
        const normalizedFood = (foodOrdersRes.data || []).map(o => ({
          ...o,
          room_number: o.room_number || (o.room_id && map[o.room_id]) || '-',
          created_at: o.created_at || o.createdAt || '-',
        }));

        // Normalize expenses to avoid N/A and ensure consistent keys
        const normalizedExpenses = (expensesRes.data || []).map(e => ({
          category: e.category || '-',
          description: e.description || '-',
          amount: e.amount != null ? e.amount : '-',
          expense_date: e.expense_date || e.date || '-',
        }));

        // Normalize employees: convert join_date -> hire_date, role object -> role name
        const normalizedEmployees = (employeesRes.data || []).map(emp => ({
          name: emp.name || '-',
          role: (emp.role?.name) || emp.role || '-',
          salary: emp.salary != null ? emp.salary : '-',
          hire_date: emp.hire_date || emp.join_date || '-',
        }));

        setDetailedData({
          roomBookings: roomBookingsRes.data.bookings || [],
          packageBookings: packageBookingsRes.data || [],
          foodOrders: normalizedFood,
          expenses: normalizedExpenses,
          employees: normalizedEmployees,
        });
      } catch (err) {
        console.error("Failed to fetch detailed data:", err);
        // Set empty data instead of keeping old data to prevent confusion
        setDetailedData({
          roomBookings: [],
          packageBookings: [],
          foodOrders: [],
          expenses: [],
          employees: [],
        });
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchDetailedData();
  }, [period]);

  const loadMore = async (dataType) => {
    if (isSubmitting || !pagination[dataType].hasMore) return;

    setIsSubmitting(true);
    try {
      const fromDate = getPeriodDate(period);
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      const currentSkip = pagination[dataType].skip + PAGE_LIMIT;
      params.append('skip', currentSkip);
      params.append('limit', PAGE_LIMIT);
      const queryString = params.toString();

      // Map data types to API paths explicitly
      const endpointMap = {
        roomBookings: '/bookings',
        packageBookings: '/reports/package-bookings',
        foodOrders: '/reports/food-orders',
        expenses: '/reports/expenses',
        employees: '/employees',
      };
      const path = endpointMap[dataType] || `/${dataType.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      const response = await API.get(`${path}?${queryString}`).catch(async () => {
        // Fallback to base endpoints
        const fallback = {
          roomBookings: '/bookings',
          packageBookings: '/report/package-bookings',
          foodOrders: '/food-orders',
          expenses: '/expenses',
          employees: '/employees',
        };
        return API.get(`${fallback[dataType]}?${queryString}`);
      });
      let newData = dataType === 'roomBookings' ? (response.data.bookings || []) : (response.data || []);
      if (dataType === 'foodOrders') {
        newData = newData.map(o => ({ ...o, room_number: o.room_number || (o.room_id && roomMap[o.room_id]) || '-', created_at: o.created_at || o.createdAt || '-' }));
      }

      // Use functional update to prevent race conditions
      setDetailedData(prev => ({
        ...prev,
        [dataType]: [...prev[dataType], ...newData]
      }));

      setPagination(prev => ({
        ...prev,
        [dataType]: { skip: currentSkip, hasMore: newData.length === PAGE_LIMIT }
      }));
    } catch (err) {
      console.error(`Failed to load more ${dataType}:`, err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen text-red-500 text-lg">
          <p>{error}</p>
        </div>
      </DashboardLayout>
    );
  }

  const getPeriodDate = (period) => {
    const date = new Date();
    if (period === 'day') {
      // No change
    } else if (period === 'week') {
      date.setDate(date.getDate() - 7);
    } else if (period === 'month') {
      date.setMonth(date.getMonth() - 1);
    } else {
      return ''; // all time
    }
    return date.toISOString().split('T')[0];
  };

  return (
    <DashboardLayout>
      {/* Animated Background */}
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

      <div className="p-6 md:p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">Comprehensive Dashboard</h1>
          <div className="flex items-center space-x-2 bg-white p-1 rounded-lg shadow">
            {['day', 'week', 'month', 'all'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${period === p ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {p === 'day' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
        </div>

        {/* ===== KPI Grid ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
          <KpiCard title="Room Bookings" value={kpiData.room_bookings || 0} loading={loading} icon={<BedDouble className="text-purple-500 w-8 h-8" />} />
          <KpiCard title="Package Bookings" value={kpiData.package_bookings || 0} loading={loading} icon={<Package className="text-indigo-500 w-8 h-8" />} />
          <KpiCard title="Total Bookings" value={kpiData.total_bookings || 0} loading={loading} icon={<Calendar className="text-blue-500 w-8 h-8" />} />
          
          <KpiCard title="Food Orders" value={kpiData.food_orders || 0} loading={loading} icon={<Utensils className="text-orange-500 w-8 h-8" />} />
          <KpiCard title="Services Assigned" value={kpiData.assigned_services || 0} loading={loading} icon={<ConciergeBell className="text-teal-500 w-8 h-8" />} />
          <KpiCard title="Services Completed" value={kpiData.completed_services || 0} loading={loading} icon={<CheckCircle className="text-green-500 w-8 h-8" />} />

          <KpiCard title="Total Expenses" value={kpiData.total_expenses || 0} prefix="₹" loading={loading} icon={<DollarSign className="text-red-500 w-8 h-8" />} />
          <KpiCard title="Expense Count" value={kpiData.expense_count || 0} loading={loading} icon={<ShoppingCart className="text-red-400 w-8 h-8" />} />

          <KpiCard title="Active Employees" value={kpiData.active_employees || 0} loading={loading} icon={<Users className="text-cyan-500 w-8 h-8" />} />
          <KpiCard title="Total Salary" value={kpiData.total_salary || 0} prefix="₹" loading={loading} icon={<Briefcase className="text-gray-600 w-8 h-8" />} />

          <KpiCard title="Food Items" value={kpiData.food_items_available || 0} suffix=" Available" loading={loading} icon={<Utensils className="text-yellow-500 w-8 h-8" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Revenue Breakdown Pie Chart */}
          <SectionCard title="Revenue Breakdown (All Time)" icon={<DollarSign className="text-green-600" />} loading={chartLoading} className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData.revenue_breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.revenue_breakdown.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Weekly Performance Bar Chart */}
          <SectionCard title="Weekly Performance" icon={<TrendingUp className="text-blue-600" />} loading={chartLoading} className="lg:col-span-3">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.weekly_performance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue (₹)" />
                <Bar yAxisId="right" dataKey="checkouts" fill="#82ca9d" name="Checkouts" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>

        {/* --- Detailed Data Section --- */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Detailed Reports for Period: <span className="text-indigo-600 capitalize">{period}</span></h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DetailTable title="Room Bookings" headers={['Guest Name', 'Check In', 'Check Out', 'Status']} data={detailedData.roomBookings} loading={detailsLoading} hasMore={pagination.roomBookings.hasMore} loadMore={roomBookingsRef} isSubmitting={isSubmitting} />
            <DetailTable title="Package Bookings" headers={['Guest Name', 'Check In', 'Check Out', 'Status']} data={detailedData.packageBookings} loading={detailsLoading} hasMore={pagination.packageBookings.hasMore} loadMore={packageBookingsRef} isSubmitting={isSubmitting} />
            <DetailTable title="Food Orders" headers={['Room Number', 'Amount', 'Status', 'Created At']} data={detailedData.foodOrders} loading={detailsLoading} hasMore={pagination.foodOrders.hasMore} loadMore={foodOrdersRef} isSubmitting={isSubmitting} />
            <DetailTable title="Expenses" headers={['Category', 'Description', 'Amount', 'Expense Date']} data={detailedData.expenses} loading={detailsLoading} hasMore={pagination.expenses.hasMore} loadMore={expensesRef} isSubmitting={isSubmitting} />
            <DetailTable title="Employee Salaries" headers={['Name', 'Role', 'Salary', 'Hire Date']} data={detailedData.employees} loading={detailsLoading} hasMore={pagination.employees.hasMore} loadMore={employeesRef} isSubmitting={isSubmitting} />
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
