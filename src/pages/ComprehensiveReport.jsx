import React, { useEffect, useState } from "react";
import { formatCurrency } from '../utils/currency';
import DashboardLayout from "../layout/DashboardLayout";
import API from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Hotel, Utensils, Package, Home, DollarSign, Shield, 
  Calendar, Download, Filter, Search, FileText, TrendingUp,
  Users, BedDouble, Receipt, ShoppingCart, AlertTriangle,
  Clock, XCircle, Gift, Box, AlertCircle, FileCheck,
  Wrench, Key, UserCheck, CreditCard, BarChart3
} from "lucide-react";

// ============================================
// UTILITY COMPONENTS
// ============================================

const SectionCard = ({ title, icon, children, loading, count, className = "" }) => {
  return (
    <motion.div
      className={`bg-white rounded-2xl shadow-lg p-6 flex flex-col ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3">
        <div className="flex items-center">
          {icon}
          <h2 className="text-xl font-bold text-gray-800 ml-3">{title}</h2>
        </div>
        {!loading && count !== undefined && (
          <span className="text-sm font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
            {count} Records
          </span>
        )}
        {loading && <div className="h-6 w-20 bg-gray-200 rounded-full animate-pulse"></div>}
      </div>
      <div className="overflow-auto max-h-96">
        {loading 
          ? <div className="space-y-2 mt-2">
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          : children}
      </div>
    </motion.div>
  );
};

const DataTable = ({ headers, data, renderRow, emptyMessage = "No data available" }) => {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-gray-500">{emptyMessage}</div>;
  }
  
  return (
    <table className="w-full text-sm text-left">
      <thead className="text-gray-600 uppercase tracking-wider bg-gray-50 sticky top-0">
        <tr>
          {headers.map((h) => <th key={h} className="p-3">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {data.map((item, index) => renderRow(item, index))}
      </tbody>
    </table>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

// ============================================
// REPORT FILTER COMPONENT
// ============================================

const ReportFilters = ({ filters, onFilterChange, onClear }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-6">
      <div className="flex items-center gap-4 flex-wrap">
        {filters.map((filter, idx) => (
          <div key={idx} className="flex-1 min-w-[200px]">
            <label htmlFor={filter.id} className="block text-sm font-medium text-gray-700 mb-1">
              {filter.label}
            </label>
            {filter.type === 'date' ? (
              <input
                type="date"
                id={filter.id}
                value={filter.value || ''}
                onChange={(e) => onFilterChange(filter.id, e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            ) : filter.type === 'select' ? (
              <select
                id={filter.id}
                value={filter.value || ''}
                onChange={(e) => onFilterChange(filter.id, e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">All</option>
                {filter.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id={filter.id}
                value={filter.value || ''}
                onChange={(e) => onFilterChange(filter.id, e.target.value)}
                placeholder={filter.placeholder}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            )}
          </div>
        ))}
        {onClear && (
          <button
            onClick={onClear}
            className="mt-6 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function ComprehensiveReport() {
  const [activeTab, setActiveTab] = useState('all-reports');
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({});
  
  // All Reports States
  const [allReportsType, setAllReportsType] = useState("food-orders");
  const [allReportsData, setAllReportsData] = useState(null);
  const [allReportsLoading, setAllReportsLoading] = useState(false);
  const [allReportsStartDate, setAllReportsStartDate] = useState("");
  const [allReportsEndDate, setAllReportsEndDate] = useState("");

  // Report definitions organized by department
  const reportDefinitions = {
    'front-office': [
      { id: 'daily-arrival', name: 'Daily Arrival Report', icon: Calendar, endpoint: '/reports/front-office/daily-arrival' },
      { id: 'daily-departure', name: 'Daily Departure Report', icon: Calendar, endpoint: '/reports/front-office/daily-departure' },
      { id: 'occupancy', name: 'Occupancy Report', icon: BedDouble, endpoint: '/reports/front-office/occupancy' },
      { id: 'police-c-form', name: 'Police / C-Form Report', icon: FileText, endpoint: '/reports/front-office/police-c-form' },
      { id: 'night-audit', name: 'Night Audit Report', icon: Clock, endpoint: '/reports/front-office/night-audit' },
      { id: 'no-show-cancellation', name: 'No-Show & Cancellation', icon: XCircle, endpoint: '/reports/front-office/no-show-cancellation' },
      { id: 'in-house-guests', name: 'In-House Guest List', icon: Users, endpoint: '/reports/front-office/in-house-guests' },
    ],
    'restaurant': [
      { id: 'daily-sales-summary', name: 'Daily Sales Summary', icon: BarChart3, endpoint: '/reports/restaurant/daily-sales-summary' },
      { id: 'item-wise-sales', name: 'Item-wise Sales Report', icon: TrendingUp, endpoint: '/reports/restaurant/item-wise-sales' },
      { id: 'kot-analysis', name: 'KOT Analysis', icon: Clock, endpoint: '/reports/restaurant/kot-analysis' },
      { id: 'void-cancellation', name: 'Void / Cancellation Report', icon: XCircle, endpoint: '/reports/restaurant/void-cancellation' },
      { id: 'discount-complimentary', name: 'Discount & Complimentary', icon: Gift, endpoint: '/reports/restaurant/discount-complimentary' },
      { id: 'nc-report', name: 'NC (Non-Chargeable) Report', icon: Receipt, endpoint: '/reports/restaurant/nc-report' },
    ],
    'inventory': [
      { id: 'stock-status', name: 'Stock Status Report', icon: Package, endpoint: '/reports/inventory/stock-status' },
      { id: 'low-stock-alert', name: 'Low Stock Alert Report', icon: AlertCircle, endpoint: '/reports/inventory/low-stock-alert' },
      { id: 'expiry-aging', name: 'Expiry / Aging Report', icon: AlertTriangle, endpoint: '/reports/inventory/expiry-aging' },
      { id: 'stock-movement', name: 'Stock Movement Register', icon: TrendingUp, endpoint: '/reports/inventory/stock-movement' },
      { id: 'waste-spoilage', name: 'Waste & Spoilage Report', icon: XCircle, endpoint: '/reports/inventory/waste-spoilage' },
      { id: 'purchase-register', name: 'Purchase Register', icon: ShoppingCart, endpoint: '/reports/inventory/purchase-register' },
      { id: 'variance', name: 'Variance Report', icon: FileCheck, endpoint: '/reports/inventory/variance' },
    ],
    'housekeeping': [
      { id: 'room-discrepancy', name: 'Room Discrepancy Report', icon: AlertTriangle, endpoint: '/reports/housekeeping/room-discrepancy' },
      { id: 'laundry-cost', name: 'Laundry Cost Report', icon: Home, endpoint: '/reports/housekeeping/laundry-cost' },
      { id: 'minibar-consumption', name: 'Minibar Consumption', icon: Package, endpoint: '/reports/housekeeping/minibar-consumption' },
      { id: 'lost-found', name: 'Lost & Found Register', icon: Box, endpoint: '/reports/housekeeping/lost-found' },
      { id: 'maintenance-tickets', name: 'Maintenance Ticket Log', icon: Wrench, endpoint: '/reports/housekeeping/maintenance-tickets' },
      { id: 'asset-audit', name: 'Asset Audit Report', icon: FileCheck, endpoint: '/reports/housekeeping/asset-audit' },
    ],
    'accounts': [
      { id: 'gstr1-b2b', name: 'GSTR-1 (B2B)', icon: FileText, endpoint: '/gst-reports/b2b-sales' },
      { id: 'gstr1-b2c', name: 'GSTR-1 (B2C)', icon: FileText, endpoint: '/gst-reports/b2c-sales' },
      { id: 'gstr3b-input', name: 'GSTR-3B Input Credit', icon: CreditCard, endpoint: '/gst-reports/itc-register' },
      { id: 'room-tariff-audit', name: 'Room Tariff Audit', icon: FileCheck, endpoint: '/gst-reports/room-tariff-slab' },
      { id: 'hsn-sac-summary', name: 'HSN/SAC Summary', icon: BarChart3, endpoint: '/gst-reports/hsn-sac-summary' },
      { id: 'rcm-register', name: 'RCM Register', icon: Receipt, endpoint: '/gst-reports/rcm-register' },
      { id: 'master-summary', name: 'GST Master Summary', icon: FileText, endpoint: '/gst-reports/master-summary' },
    ],
    'security-hr': [
      { id: 'visitor-log', name: 'Visitor Log', icon: Users, endpoint: '/reports/security/visitor-log' },
      { id: 'key-card-audit', name: 'Key Card Audit', icon: Key, endpoint: '/reports/security/key-card-audit' },
      { id: 'staff-attendance', name: 'Staff Attendance', icon: UserCheck, endpoint: '/reports/hr/staff-attendance' },
      { id: 'payroll-register', name: 'Payroll Register', icon: CreditCard, endpoint: '/reports/hr/payroll-register' },
    ],
  };

  const departmentTabs = [
    { id: 'all-reports', name: 'All Reports', icon: FileText, color: 'gray' },
    { id: 'front-office', name: 'Front Office', icon: Hotel, color: 'blue' },
    { id: 'restaurant', name: 'Restaurant (F&B)', icon: Utensils, color: 'orange' },
    { id: 'inventory', name: 'Inventory & Purchase', icon: Package, color: 'purple' },
    { id: 'housekeeping', name: 'Housekeeping & Facility', icon: Home, color: 'green' },
    { id: 'accounts', name: 'Accounts & GST', icon: DollarSign, color: 'indigo' },
    { id: 'security-hr', name: 'Security & HR', icon: Shield, color: 'red' },
  ];
  
  // Fetch All Reports data
  const fetchAllReports = async () => {
    try {
      setAllReportsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (allReportsStartDate) params.append("start_date", allReportsStartDate);
      if (allReportsEndDate) params.append("end_date", allReportsEndDate);
      
      let endpoint = "";
      switch(allReportsType) {
        case "inventory-category":
          endpoint = `/reports/comprehensive/inventory/category-wise`;
          break;
        case "inventory-department":
          endpoint = `/reports/comprehensive/inventory/department-wise`;
          break;
        case "bookings":
          endpoint = `/reports/comprehensive/bookings`;
          break;
        case "package-bookings":
          endpoint = `/reports/comprehensive/package-bookings`;
          break;
        case "expenses":
          endpoint = `/reports/comprehensive/expenses`;
          break;
        case "food-orders":
          endpoint = `/reports/comprehensive/food-orders`;
          break;
        case "purchases":
          endpoint = `/reports/comprehensive/purchases`;
          break;
        case "vendors":
          endpoint = `/reports/comprehensive/vendors`;
          break;
        case "services":
          endpoint = `/reports/comprehensive/services`;
          break;
        default:
          endpoint = `/reports/comprehensive/summary`;
      }
      
      const response = await API.get(`${endpoint}?${params.toString()}`);
      setAllReportsData(response.data);
    } catch (err) {
      console.error("Failed to fetch all reports:", err);
      setError(err.response?.data?.detail || err.message || "Failed to load report data. Please try again.");
      setAllReportsData(null);
    } finally {
      setAllReportsLoading(false);
    }
  };

  // Fetch report data
  const fetchReport = async (report) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = { ...filters };
      // Convert date strings to proper format
      if (params.report_date) params.report_date = params.report_date;
      if (params.start_date) params.start_date = params.start_date;
      if (params.end_date) params.end_date = params.end_date;
      if (params.from_date) params.from_date = params.from_date;
      if (params.to_date) params.to_date = params.to_date;
      
      const response = await API.get(report.endpoint, { params });
      setReportData(response.data);
    } catch (err) {
      console.error("Failed to fetch report:", err);
      setError(err.response?.data?.detail || err.message || "Failed to load report data. Please try again.");
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle report selection
  const handleReportSelect = (report) => {
    setActiveReport(report);
    setReportData(null);
    setFilters({});
    fetchReport(report);
  };

  // Handle filter change
  const handleFilterChange = (filterId, value) => {
    setFilters(prev => ({ ...prev, [filterId]: value }));
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({});
    if (activeReport) {
      fetchReport(activeReport);
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    if (activeReport) {
      fetchReport(activeReport);
    }
  };

  // Get filter configuration for current report
  const getReportFilters = () => {
    if (!activeReport) return [];
    
    const reportId = activeReport.id;
    const baseFilters = [];
    
    // Common date filters
    if (reportId.includes('daily') || reportId === 'occupancy' || reportId === 'night-audit') {
      baseFilters.push({
        id: 'report_date',
        label: 'Report Date',
        type: 'date',
        value: filters.report_date || new Date().toISOString().split('T')[0]
      });
    } else if (reportId !== 'low-stock-alert' && reportId !== 'room-discrepancy') {
      baseFilters.push(
        {
          id: 'start_date',
          label: 'From Date',
          type: 'date',
          value: filters.start_date || ''
        },
        {
          id: 'end_date',
          label: 'To Date',
          type: 'date',
          value: filters.end_date || ''
        }
      );
    }
    
    // Report-specific filters
    if (reportId === 'expiry-aging') {
      baseFilters.push({
        id: 'days_ahead',
        label: 'Days Ahead',
        type: 'text',
        value: filters.days_ahead || '3',
        placeholder: '3'
      });
    }
    
    return baseFilters;
  };

  // Render report content based on report type
  const renderReportContent = () => {
    if (!activeReport) {
      return (
        <div className="text-center py-16 text-gray-500">
          <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <p className="text-lg">Select a report from the list to view data</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-700 font-semibold">{error}</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      );
    }

    if (!reportData) {
      return null;
    }

    // Render based on report type
    return renderReportByType(activeReport.id, reportData);
  };

  // Render specific report types
  const renderReportByType = (reportId, data) => {
    switch (reportId) {
      case 'daily-arrival':
        return (
          <SectionCard title="Daily Arrival Report" icon={<Calendar className="text-blue-600" />} loading={loading} count={data.total}>
            <DataTable
              headers={["Guest Name", "Mobile", "Room", "Room Type", "Adults", "Children", "Advance Paid", "Total Amount", "Type"]}
              data={data.arrivals || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.guest_name}</td>
                  <td className="p-3">{item.guest_mobile || '-'}</td>
                  <td className="p-3">{item.room_number}</td>
                  <td className="p-3">{item.room_type}</td>
                  <td className="p-3">{item.adults}</td>
                  <td className="p-3">{item.children}</td>
                  <td className="p-3">{formatCurrency(item.advance_paid)}</td>
                  <td className="p-3">{formatCurrency(item.total_amount)}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {item.booking_type}
                    </span>
                  </td>
                </tr>
              )}
            />
          </SectionCard>
        );

      case 'daily-departure':
        return (
          <SectionCard title="Daily Departure Report" icon={<Calendar className="text-blue-600" />} loading={loading} count={data.total}>
            <DataTable
              headers={["Room", "Guest Name", "Checkout Time", "Room Total", "Food Total", "Service Total", "Grand Total", "Balance Pending"]}
              data={data.departures || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.room_number}</td>
                  <td className="p-3">{item.guest_name}</td>
                  <td className="p-3">{formatDateTime(item.checkout_time)}</td>
                  <td className="p-3">{formatCurrency(item.room_total)}</td>
                  <td className="p-3">{formatCurrency(item.food_total)}</td>
                  <td className="p-3">{formatCurrency(item.service_total)}</td>
                  <td className="p-3 font-semibold">{formatCurrency(item.grand_total)}</td>
                  <td className="p-3">
                    <span className={item.balance_pending > 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                      {formatCurrency(item.balance_pending)}
                    </span>
                  </td>
                </tr>
              )}
            />
          </SectionCard>
        );

      case 'occupancy':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SectionCard title="Total Rooms" icon={<BedDouble className="text-indigo-600" />} count={data.total_rooms} />
            <SectionCard title="Occupied Rooms" icon={<BedDouble className="text-green-600" />} count={data.occupied_rooms} />
            <SectionCard title="Vacant Rooms" icon={<BedDouble className="text-blue-600" />} count={data.vacant_rooms} />
            <SectionCard 
              title="Occupancy %" 
              icon={<TrendingUp className="text-purple-600" />} 
              count={`${data.occupancy_percentage}%`}
            />
          </div>
        );

      case 'night-audit':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Revenue Summary" icon={<DollarSign className="text-green-600" />}>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Room Revenue:</span>
                  <span className="font-semibold">{formatCurrency(data.room_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Food & Beverage:</span>
                  <span className="font-semibold">{formatCurrency(data.food_beverage_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Revenue:</span>
                  <span className="font-semibold">{formatCurrency(data.service_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax Collected:</span>
                  <span className="font-semibold">{formatCurrency(data.tax_collected)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-800 font-bold">Total Revenue:</span>
                  <span className="text-indigo-600 font-bold text-lg">{formatCurrency(data.total_revenue)}</span>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Checkouts" icon={<Users className="text-blue-600" />} count={data.checkouts_count} />
          </div>
        );

      case 'daily-sales-summary':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Sales by Category" icon={<BarChart3 className="text-orange-600" />}>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Food Sales:</span>
                  <span className="font-semibold">{formatCurrency(data.food_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Beverage Sales:</span>
                  <span className="font-semibold">{formatCurrency(data.beverage_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Alcohol Sales:</span>
                  <span className="font-semibold">{formatCurrency(data.alcohol_sales)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-800 font-bold">Total Sales:</span>
                  <span className="text-indigo-600 font-bold text-lg">{formatCurrency(data.total_sales)}</span>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="Sales by Meal Period" icon={<Clock className="text-purple-600" />}>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Breakfast:</span>
                  <span className="font-semibold">{formatCurrency(data.breakfast_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Lunch:</span>
                  <span className="font-semibold">{formatCurrency(data.lunch_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dinner:</span>
                  <span className="font-semibold">{formatCurrency(data.dinner_sales)}</span>
                </div>
              </div>
            </SectionCard>
          </div>
        );

      case 'item-wise-sales':
        return (
          <SectionCard title="Item-wise Sales Report" icon={<TrendingUp className="text-orange-600" />} loading={loading} count={data.total_items}>
            <DataTable
              headers={["Item Name", "Total Quantity", "Total Revenue"]}
              data={data.items || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.item_name}</td>
                  <td className="p-3">{item.total_quantity}</td>
                  <td className="p-3 font-semibold">{formatCurrency(item.total_revenue)}</td>
                </tr>
              )}
            />
          </SectionCard>
        );

      case 'stock-status':
        return (
          <SectionCard title="Stock Status Report" icon={<Package className="text-purple-600" />} loading={loading} count={data.total}>
            <DataTable
              headers={["Item Name", "Item Code", "Category", "Current Stock", "Unit Price", "Stock Value", "Status"]}
              data={data.stock_status || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.item_name}</td>
                  <td className="p-3">{item.item_code}</td>
                  <td className="p-3">{item.category}</td>
                  <td className="p-3">{item.current_stock} {item.unit}</td>
                  <td className="p-3">{formatCurrency(item.unit_price)}</td>
                  <td className="p-3 font-semibold">{formatCurrency(item.stock_value)}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.status === 'Low Stock' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              )}
            />
          </SectionCard>
        );

      case 'low-stock-alert':
        return (
          <SectionCard title="Low Stock Alert Report" icon={<AlertCircle className="text-red-600" />} loading={loading} count={data.total}>
            <DataTable
              headers={["Item Name", "Item Code", "Category", "Current Stock", "Min Level", "Shortage", "Urgency", "Preferred Vendor"]}
              data={data.low_stock_items || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.item_name}</td>
                  <td className="p-3">{item.item_code}</td>
                  <td className="p-3">{item.category}</td>
                  <td className="p-3">{item.current_stock} {item.unit}</td>
                  <td className="p-3">{item.min_stock_level} {item.unit}</td>
                  <td className="p-3 text-red-600 font-semibold">{item.shortage} {item.unit}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      item.urgency === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {item.urgency}
                    </span>
                  </td>
                  <td className="p-3">{item.preferred_vendor}</td>
                </tr>
              )}
            />
          </SectionCard>
        );

      case 'staff-attendance':
        return (
          <SectionCard title="Staff Attendance Report" icon={<UserCheck className="text-blue-600" />} loading={loading} count={data.total}>
            <DataTable
              headers={["Employee Name", "Date", "Check In", "Check Out", "Hours Worked", "Location"]}
              data={data.attendance_logs || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.employee_name}</td>
                  <td className="p-3">{formatDate(item.date)}</td>
                  <td className="p-3">{item.check_in_time ? formatDateTime(item.check_in_time) : '-'}</td>
                  <td className="p-3">{item.check_out_time ? formatDateTime(item.check_out_time) : '-'}</td>
                  <td className="p-3">{item.hours_worked || '-'} hrs</td>
                  <td className="p-3">{item.location || '-'}</td>
                </tr>
              )}
            />
          </SectionCard>
        );

      case 'payroll-register':
        return (
          <SectionCard title="Payroll Register" icon={<CreditCard className="text-indigo-600" />} loading={loading} count={data.total}>
            <DataTable
              headers={["Employee Name", "Role", "Basic Salary", "Attendance Days", "OT Hours", "OT Amount", "Leave Deduction", "Net Salary"]}
              data={data.payroll || []}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="p-3 font-semibold">{item.employee_name}</td>
                  <td className="p-3">{item.role}</td>
                  <td className="p-3">{formatCurrency(item.basic_salary)}</td>
                  <td className="p-3">{item.attendance_days}</td>
                  <td className="p-3">{item.ot_hours}</td>
                  <td className="p-3">{formatCurrency(item.ot_amount)}</td>
                  <td className="p-3 text-red-600">{formatCurrency(item.leave_deduction)}</td>
                  <td className="p-3 font-bold text-green-600">{formatCurrency(item.net_salary)}</td>
                </tr>
              )}
            />
          </SectionCard>
        );

      default:
        // Generic table renderer for other reports
        const dataKeys = Object.keys(data || {});
        const tableData = dataKeys.length > 0 && Array.isArray(data[dataKeys[0]]) 
          ? data[dataKeys[0]] 
          : (Array.isArray(data) ? data : []);
        
        if (tableData.length === 0) {
          return (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-gray-500">No data available for this report</p>
              {data.message && <p className="text-sm text-gray-400 mt-2">{data.message}</p>}
            </div>
          );
        }

        const headers = Object.keys(tableData[0] || {});
        return (
          <SectionCard title={activeReport.name} icon={<FileText className="text-indigo-600" />} loading={loading} count={tableData.length}>
            <DataTable
              headers={headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}
              data={tableData}
              renderRow={(item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {headers.map(header => (
                    <td key={header} className="p-3">
                      {typeof item[header] === 'number' && header.includes('amount') || header.includes('price') || header.includes('total') || header.includes('salary')
                        ? formatCurrency(item[header])
                        : typeof item[header] === 'string' && item[header].includes('T') && item[header].includes('-')
                        ? formatDate(item[header])
                        : String(item[header] || '-')}
                    </td>
                  ))}
                </tr>
              )}
            />
          </SectionCard>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Comprehensive Reports</h1>
          {activeReport && (
            <button
              onClick={() => {
                setActiveReport(null);
                setReportData(null);
                setFilters({});
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Back to Reports
            </button>
          )}
        </div>

        {!activeReport ? (
          // Report selection view
          <div className="space-y-6">
            {/* Department Tabs */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex space-x-1 overflow-x-auto">
                {departmentTabs.map((tab) => {
                  const getTabClasses = () => {
                    if (activeTab === tab.id) {
                      const colorMap = {
                        blue: 'bg-blue-100 text-blue-700 border-2 border-blue-300',
                        orange: 'bg-orange-100 text-orange-700 border-2 border-orange-300',
                        purple: 'bg-purple-100 text-purple-700 border-2 border-purple-300',
                        green: 'bg-green-100 text-green-700 border-2 border-green-300',
                        indigo: 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300',
                        red: 'bg-red-100 text-red-700 border-2 border-red-300',
                        gray: 'bg-gray-100 text-gray-700 border-2 border-gray-300',
                      };
                      return colorMap[tab.color] || 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300';
                    }
                    return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
                  };
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${getTabClasses()}`}
                    >
                      <tab.icon className="h-5 w-5" />
                      {tab.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* All Reports Section */}
            {activeTab === 'all-reports' ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">All Reports</h2>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">Start Date:</label>
                        <input
                          type="date"
                          value={allReportsStartDate}
                          onChange={(e) => setAllReportsStartDate(e.target.value)}
                          className="border rounded px-3 py-1"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium">End Date:</label>
                        <input
                          type="date"
                          value={allReportsEndDate}
                          onChange={(e) => setAllReportsEndDate(e.target.value)}
                          className="border rounded px-3 py-1"
                        />
                      </div>
                      <button
                        onClick={fetchAllReports}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        disabled={allReportsLoading}
                      >
                        {allReportsLoading ? "Loading..." : "Generate Report"}
                      </button>
                    </div>
                  </div>

                  {/* Report Type Selector */}
                  <div className="mb-6 flex flex-wrap gap-2 border-b pb-4">
                    {[
                      { id: "inventory-category", label: "Inventory (Category)" },
                      { id: "inventory-department", label: "Inventory (Department)" },
                      { id: "bookings", label: "Bookings" },
                      { id: "package-bookings", label: "Package Bookings" },
                      { id: "expenses", label: "Expenses" },
                      { id: "food-orders", label: "Food Orders" },
                      { id: "purchases", label: "Purchases" },
                      { id: "vendors", label: "Vendors" },
                      { id: "services", label: "Services" },
                    ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setAllReportsType(type.id)}
                        className={`px-4 py-2 rounded ${
                          allReportsType === type.id
                            ? "bg-indigo-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>

                  {/* Report Content */}
                  {allReportsLoading ? (
                    <div className="text-center py-8">Loading report...</div>
                  ) : allReportsData ? (
                    <div className="space-y-4">
                      <SectionCard title={`${allReportsType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`} icon={<FileText className="text-indigo-600" />}>
                        <div className="overflow-x-auto">
                          {Array.isArray(allReportsData) && allReportsData.length > 0 ? (
                            <DataTable
                              headers={Object.keys(allReportsData[0]).map(k => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}
                              data={allReportsData}
                              renderRow={(item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  {Object.keys(allReportsData[0]).map(key => (
                                    <td key={key} className="p-3">
                                      {typeof item[key] === 'number' && (key.includes('amount') || key.includes('price') || key.includes('value') || key.includes('total'))
                                        ? formatCurrency(item[key])
                                        : typeof item[key] === 'string' && item[key].includes('T') && item[key].includes('-')
                                        ? formatDate(item[key])
                                        : Array.isArray(item[key])
                                        ? item[key].join(', ')
                                        : String(item[key] || '-')}
                                    </td>
                                  ))}
                                </tr>
                              )}
                            />
                          ) : (
                            <div className="text-center py-8 text-gray-500">No data available for this report</div>
                          )}
                        </div>
                      </SectionCard>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      Select a report type and click "Generate Report" to load data
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Reports List for other tabs */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportDefinitions[activeTab]?.map((report) => (
                  <motion.div
                    key={report.id}
                    onClick={() => handleReportSelect(report)}
                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-indigo-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <report.icon className="h-6 w-6 text-indigo-600" />
                      <h3 className="font-semibold text-gray-800">{report.name}</h3>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Click to view report</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Report detail view
          <div className="space-y-6">
            {/* Report Header */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <activeReport.icon className="h-8 w-8 text-indigo-600" />
                <h2 className="text-2xl font-bold text-gray-800">{activeReport.name}</h2>
              </div>
              
              {/* Filters */}
              {getReportFilters().length > 0 && (
                <>
                  <ReportFilters
                    filters={getReportFilters()}
                    onFilterChange={handleFilterChange}
                    onClear={handleClearFilters}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleApplyFilters}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                    >
                      Apply Filters
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Report Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeReport.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {renderReportContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
