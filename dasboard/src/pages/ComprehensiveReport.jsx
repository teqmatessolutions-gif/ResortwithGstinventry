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
import { formatDateIST } from "../utils/dateUtils";

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
    return formatDateIST(dateString);
  } catch {
    return dateString;
  }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  try {
    // Handle time-only strings (HH:MM:SS format)
    if (typeof dateString === 'string' && /^\d{2}:\d{2}:\d{2}/.test(dateString)) {
      // If it's just a time string, format it nicely
      const timeParts = dateString.split(':');
      return `${timeParts[0]}:${timeParts[1]}`;
    }

    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if invalid
    }
    return date.toLocaleString('en-GB', {
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

const formatTime = (timeString) => {
  if (!timeString) return '-';
  try {
    // Handle time-only strings (HH:MM:SS format)
    if (typeof timeString === 'string' && /^\d{2}:\d{2}:\d{2}/.test(timeString)) {
      const timeParts = timeString.split(':');
      return `${timeParts[0]}:${timeParts[1]}`;
    }

    // Try parsing as datetime and extract time
    const date = new Date(timeString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return timeString;
  } catch {
    return timeString;
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
  const [activeTab, setActiveTab] = useState('front-office');
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({});

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
    'security-hr': [
      { id: 'visitor-log', name: 'Visitor Log', icon: Users, endpoint: '/reports/security/visitor-log' },
      { id: 'staff-attendance', name: 'Staff Attendance', icon: UserCheck, endpoint: '/reports/hr/staff-attendance' },
      { id: 'payroll-register', name: 'Payroll Register', icon: CreditCard, endpoint: '/reports/hr/payroll-register' },
    ],
  };

  const departmentTabs = [
    { id: 'front-office', name: 'Front Office', icon: Hotel, color: 'blue' },
    { id: 'restaurant', name: 'Restaurant (F&B)', icon: Utensils, color: 'orange' },
    { id: 'inventory', name: 'Inventory & Purchase', icon: Package, color: 'purple' },
    { id: 'housekeeping', name: 'Housekeeping & Facility', icon: Home, color: 'green' },
    { id: 'security-hr', name: 'Security & HR', icon: Shield, color: 'red' },
  ];

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
      // Convert month and year to integers for payroll
      if (params.month) params.month = parseInt(params.month);
      if (params.year) params.year = parseInt(params.year);

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

    if (reportId === 'payroll-register') {
      const today = new Date();
      baseFilters.push({
        id: 'month',
        label: 'Month',
        type: 'number',
        value: filters.month || (today.getMonth() + 1),
        placeholder: '1-12',
        min: 1,
        max: 12
      });
      baseFilters.push({
        id: 'year',
        label: 'Year',
        type: 'number',
        value: filters.year || today.getFullYear(),
        placeholder: 'YYYY',
        min: 2020,
        max: 2100
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
        // Handle both array and object responses
        const arrivals = Array.isArray(data) ? data : (data?.arrivals || []);
        const total = Array.isArray(data) ? data.length : (data?.total || 0);
        const reportDate = data?.date || filters.report_date || new Date().toISOString().split('T')[0];

        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Report Date:</strong> {new Date(reportDate).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
              {total === 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  No arrivals found for this date. Try selecting a different date.
                </p>
              )}
            </div>
            <SectionCard title="Daily Arrival Report" icon={<Calendar className="text-blue-600" />} loading={loading} count={total}>
              <DataTable
                headers={["Guest Name", "Mobile", "Room", "Room Type", "Adults", "Children", "Advance Paid", "Total Amount", "Type"]}
                data={arrivals}
                emptyMessage="No arrivals found for the selected date"
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
          </div>
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

      case 'discount-complimentary':
        const discountsComplimentary = data?.discounts_complimentary || [];
        const totalDiscComp = data?.total || 0;
        const totalComplimentaryAmount = data?.total_complimentary_amount || 0;
        const totalDiscountAmount = data?.total_discount_amount || 0;
        const complimentaryCount = data?.complimentary_count || 0;
        const discountCount = data?.discount_count || 0;
        return (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800">
                <strong>Manager Approval Tracking:</strong> This report tracks all discounted and complimentary meals for audit purposes.
              </p>
              {data?.date_range && (
                <p className="text-sm text-orange-700 mt-1">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-semibold">Total Records: </span>
                  <span className="text-orange-600">{totalDiscComp}</span>
                </div>
                <div>
                  <span className="font-semibold">Complimentary: </span>
                  <span className="text-red-600">{complimentaryCount} ({formatCurrency(totalComplimentaryAmount)})</span>
                </div>
                <div>
                  <span className="font-semibold">Discounted: </span>
                  <span className="text-orange-600">{discountCount} ({formatCurrency(totalDiscountAmount)})</span>
                </div>
                <div>
                  <span className="font-semibold">Total Value: </span>
                  <span className="text-orange-600">{formatCurrency(totalComplimentaryAmount + totalDiscountAmount)}</span>
                </div>
              </div>
            </div>
            <SectionCard title="Discount & Complimentary Report" icon={<Gift className="text-orange-600" />} loading={loading} count={totalDiscComp}>
              <DataTable
                headers={["Order ID", "Room", "Guest", "Order Date/Time", "Original Amount", "Discount", "Final Amount", "Items", "Employee", "Type", "Reason"]}
                data={discountsComplimentary}
                emptyMessage="No discounted or complimentary orders found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">#{item.order_id}</td>
                    <td className="p-3">{item.room_number}</td>
                    <td className="p-3">{item.guest_name || '-'}</td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div>{item.order_time ? formatDateTime(item.order_time) : '-'}</div>
                      </div>
                    </td>
                    <td className="p-3">{formatCurrency(item.original_amount)}</td>
                    <td className="p-3">
                      <span className={`font-semibold ${item.is_complimentary ? 'text-red-600' : 'text-orange-600'}`}>
                        {formatCurrency(item.discount_amount)}
                      </span>
                    </td>
                    <td className="p-3 font-semibold">{formatCurrency(item.final_amount)}</td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="font-medium">{item.items_count} items</div>
                        {item.items_detail && item.items_detail !== 'N/A' && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={item.items_detail}>
                            {item.items_detail}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{item.employee_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {item.order_type === 'room_service' ? 'Room Service' : 'Dine-in'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.is_complimentary ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                        {item.reason || (item.is_complimentary ? 'Complimentary' : 'Discount')}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'void-cancellation':
        const voidedOrders = data?.voided_orders || [];
        const totalVoided = data?.total || 0;
        const totalVoidAmount = data?.total_amount || 0;
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Security Report:</strong> This report tracks all voided and cancelled food orders to prevent theft and track discrepancies.
              </p>
              {data?.date_range && (
                <p className="text-sm text-red-700 mt-1">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              )}
              <div className="mt-2 flex gap-4 text-sm">
                <span className="font-semibold">Total Voided Orders: <span className="text-red-600">{totalVoided}</span></span>
                <span className="font-semibold">Total Amount: <span className="text-red-600">{formatCurrency(totalVoidAmount)}</span></span>
              </div>
            </div>
            <SectionCard title="Void / Cancellation Report" icon={<XCircle className="text-red-600" />} loading={loading} count={totalVoided}>
              <DataTable
                headers={["Order ID", "Room", "Guest", "Order Date/Time", "Amount", "Items", "Employee", "Status", "Type"]}
                data={voidedOrders}
                emptyMessage="No voided or cancelled orders found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">#{item.order_id}</td>
                    <td className="p-3">{item.room_number}</td>
                    <td className="p-3">{item.guest_name || '-'}</td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div>{item.order_time ? formatDateTime(item.order_time) : '-'}</div>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-red-600">{formatCurrency(item.amount)}</td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="font-medium">{item.items_count} items</div>
                        {item.items_detail && item.items_detail !== 'N/A' && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs truncate" title={item.items_detail}>
                            {item.items_detail}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3">{item.employee_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {item.order_type === 'room_service' ? 'Room Service' : 'Dine-in'}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'nc-report':
        const ncOrders = data?.nc_orders || [];
        const totalNC = data?.total || 0;
        const totalNCValue = data?.total_value || 0;
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Non-Chargeable Report:</strong> This report tracks food given to staff or owners (No revenue, but inventory reduced).
              </p>
              {data?.date_range && (
                <p className="text-sm text-purple-700 mt-1">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              )}
              <div className="mt-2 flex gap-4 text-sm">
                <span className="font-semibold">Total Orders: <span className="text-purple-600">{totalNC}</span></span>
                <span className="font-semibold">Total Inventory Value: <span className="text-purple-600">{formatCurrency(totalNCValue)}</span></span>
              </div>
            </div>
            <SectionCard title="NC (Non-Chargeable) Report" icon={<Receipt className="text-purple-600" />} loading={loading} count={totalNC}>
              <DataTable
                headers={["Order ID", "Recipient", "Type", "Room", "Order Date/Time", "Items", "Total Value", "Employee", "Status"]}
                data={ncOrders}
                emptyMessage="No non-chargeable orders found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">#{item.order_id}</td>
                    <td className="p-3">
                      <div>
                        <div className="font-medium">{item.recipient_name}</div>
                        <div className="text-xs text-gray-500">{item.recipient_type}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.recipient_type === 'Staff' ? 'bg-blue-100 text-blue-800' :
                          item.recipient_type === 'Staff/Owner' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                        {item.recipient_type}
                      </span>
                    </td>
                    <td className="p-3">{item.room_number}</td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div>{item.order_time ? formatDateTime(item.order_time) : '-'}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-sm">
                        <div className="font-medium">{item.items_count} items</div>
                        {item.items && item.items.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1 max-w-xs">
                            {item.items.slice(0, 2).map((itm, i) => (
                              <div key={i} title={`${itm.item_name} x${itm.quantity}`}>
                                {itm.item_name} (x{itm.quantity})
                              </div>
                            ))}
                            {item.items.length > 2 && <div>+{item.items.length - 2} more</div>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-purple-600">{formatCurrency(item.total_value)}</td>
                    <td className="p-3">{item.employee_name}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {item.billing_status}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
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
                    <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'Low Stock' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
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
                    <span className={`px-2 py-1 text-xs rounded-full ${item.urgency === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
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

      case 'visitor-log':
        const visitors = data?.visitors || [];
        const totalVisitors = data?.total || 0;
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-sm text-purple-800">
                <strong>Visitor Log:</strong> This report tracks all visitors (guests and service visitors) based on check-in/checkout data.
              </p>
              {data?.date_range && (
                <p className="text-sm text-purple-700 mt-1">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              )}
            </div>
            <SectionCard title="Visitor Log" icon={<Users className="text-purple-600" />} loading={loading} count={totalVisitors}>
              <DataTable
                headers={["Visitor Name", "Mobile", "Email", "Purpose", "Time In", "Time Out", "Room Visited", "Host", "Duration", "Type"]}
                data={visitors}
                emptyMessage="No visitors found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.visitor_name}</td>
                    <td className="p-3">{item.visitor_mobile || '-'}</td>
                    <td className="p-3">{item.visitor_email || '-'}</td>
                    <td className="p-3">{item.purpose || '-'}</td>
                    <td className="p-3">{item.time_in ? formatDateTime(item.time_in) : '-'}</td>
                    <td className="p-3">{item.time_out ? formatDateTime(item.time_out) : '-'}</td>
                    <td className="p-3">{item.room_visited || '-'}</td>
                    <td className="p-3">{item.host_name || '-'}</td>
                    <td className="p-3">{item.duration_days ? `${item.duration_days} days` : '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.booking_type === 'Package' ? 'bg-purple-100 text-purple-800' :
                          item.booking_type === 'Service Request' ? 'bg-blue-100 text-blue-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                        {item.booking_type || 'Regular'}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'staff-attendance':
        const attendanceLogs = data?.attendance_logs || [];
        const totalAttendance = data?.total || 0;
        return (
          <div className="space-y-4">
            {data?.date_range && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              </div>
            )}
            <SectionCard title="Staff Attendance Report" icon={<UserCheck className="text-blue-600" />} loading={loading} count={totalAttendance}>
              <DataTable
                headers={["Employee Name", "Code", "Date", "Check In", "Check Out", "Hours Worked", "Location", "Services", "Status"]}
                data={attendanceLogs}
                emptyMessage="No attendance records found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.employee_name}</td>
                    <td className="p-3 text-sm text-gray-500">{item.employee_code || '-'}</td>
                    <td className="p-3">{item.date ? formatDate(item.date) : '-'}</td>
                    <td className="p-3">{item.check_in_time ? formatTime(item.check_in_time) : '-'}</td>
                    <td className="p-3">{item.check_out_time ? formatTime(item.check_out_time) : '-'}</td>
                    <td className="p-3 font-semibold">{item.hours_worked !== null && item.hours_worked !== undefined ? `${item.hours_worked} hrs` : '-'}</td>
                    <td className="p-3">{item.location || '-'}</td>
                    <td className="p-3">{item.services_assigned || 0}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {item.status || '-'}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'payroll-register':
        const payroll = data?.payroll || [];
        const totalPayroll = data?.total || 0;
        const totalPayrollAmount = data?.total_payroll || 0;
        return (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-sm text-indigo-800">
                <strong>Payroll Register:</strong> Salary calculation based on attendance, overtime, and leave deductions.
              </p>
              {data?.month_name && (
                <p className="text-sm text-indigo-700 mt-1">
                  Period: {data.month_name}
                </p>
              )}
              <div className="mt-2 flex gap-4 text-sm">
                <span className="font-semibold">Total Employees: <span className="text-indigo-600">{totalPayroll}</span></span>
                <span className="font-semibold">Total Payroll: <span className="text-indigo-600">{formatCurrency(totalPayrollAmount)}</span></span>
              </div>
            </div>
            <SectionCard title="Payroll Register" icon={<CreditCard className="text-indigo-600" />} loading={loading} count={totalPayroll}>
              <DataTable
                headers={["Employee Name", "Code", "Role", "Basic Salary", "Attendance Days", "Total Hours", "OT Hours", "OT Amount", "Leave Days", "Leave Deduction", "Net Salary"]}
                data={payroll}
                emptyMessage="No payroll data found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.employee_name}</td>
                    <td className="p-3 text-sm text-gray-500">{item.employee_code || '-'}</td>
                    <td className="p-3">{item.role || '-'}</td>
                    <td className="p-3">{formatCurrency(item.basic_salary)}</td>
                    <td className="p-3">{item.attendance_days || 0}</td>
                    <td className="p-3">{item.total_hours || 0} hrs</td>
                    <td className="p-3">{item.ot_hours || 0} hrs</td>
                    <td className="p-3 text-orange-600">{formatCurrency(item.ot_amount || 0)}</td>
                    <td className="p-3">{item.leave_days || 0}</td>
                    <td className="p-3 text-red-600">{formatCurrency(item.leave_deduction || 0)}</td>
                    <td className="p-3 font-bold text-green-600">{formatCurrency(item.net_salary || 0)}</td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'in-house-guests':
        const inHouseGuests = data?.in_house_guests || [];
        const totalInHouse = data?.total || 0;
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Emergency Evacuation List:</strong> This report lists all currently checked-in guests for emergency purposes.
              </p>
              {data?.date_range && (
                <p className="text-sm text-blue-700 mt-1">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              )}
              {totalInHouse === 0 && (
                <p className="text-sm text-blue-600 mt-2">
                  No checked-in guests found. Make sure guests are checked in with status "checked-in".
                </p>
              )}
            </div>
            <SectionCard title="In-House Guest List" icon={<Users className="text-blue-600" />} loading={loading} count={totalInHouse}>
              <DataTable
                headers={["Guest Name", "Mobile", "Email", "Room", "Check In", "Check Out", "Adults", "Children", "Type", "Status"]}
                data={inHouseGuests}
                emptyMessage="No checked-in guests found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.guest_name}</td>
                    <td className="p-3">{item.guest_mobile || '-'}</td>
                    <td className="p-3">{item.guest_email || '-'}</td>
                    <td className="p-3 font-medium">{item.room_number || '-'}</td>
                    <td className="p-3">{item.check_in ? formatDate(item.check_in) : '-'}</td>
                    <td className="p-3">{item.check_out ? formatDate(item.check_out) : '-'}</td>
                    <td className="p-3">{item.adults || 0}</td>
                    <td className="p-3">{item.children || 0}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.booking_type === 'Package' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                        {item.booking_type || 'Regular'}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        {item.status || '-'}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'police-c-form':
        const foreignNationals = data?.foreign_nationals || [];
        const totalForeign = data?.total || 0;
        return (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Legal Requirement:</strong> This report lists all currently checked-in guests for police/C-form submission.
              </p>
              {data?.date_range && (
                <p className="text-sm text-yellow-700 mt-1">
                  Date Range: {data.date_range.start ? formatDate(data.date_range.start) : 'All'} - {data.date_range.end ? formatDate(data.date_range.end) : 'All'}
                </p>
              )}
            </div>
            <SectionCard title="Police / C-Form Report" icon={<FileText className="text-red-600" />} loading={loading} count={totalForeign}>
              <DataTable
                headers={["Guest Name", "Mobile", "Email", "Check In", "Check Out", "Rooms", "Adults", "Children", "Passport", "Visa", "Nationality", "Type"]}
                data={foreignNationals}
                emptyMessage="No checked-in guests found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.guest_name}</td>
                    <td className="p-3">{item.guest_mobile || '-'}</td>
                    <td className="p-3">{item.guest_email || '-'}</td>
                    <td className="p-3">{item.check_in ? formatDate(item.check_in) : '-'}</td>
                    <td className="p-3">{item.check_out ? formatDate(item.check_out) : '-'}</td>
                    <td className="p-3">
                      {Array.isArray(item.room_numbers) ? item.room_numbers.join(', ') : (item.rooms ? item.rooms.join(', ') : '-')}
                    </td>
                    <td className="p-3">{item.adults || 0}</td>
                    <td className="p-3">{item.children || 0}</td>
                    <td className="p-3">{item.passport_number || '-'}</td>
                    <td className="p-3">{item.visa_number || '-'}</td>
                    <td className="p-3">{item.nationality || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.booking_type === 'Package' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                        {item.booking_type || 'Regular'}
                      </span>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'lost-found':
        const lostFoundItems = data?.lost_found_items || [];
        const totalLostFound = data?.total || 0;
        return (
          <div className="space-y-4">
            <SectionCard title="Lost & Found Register" icon={<Box className="text-green-600" />} loading={loading} count={totalLostFound}>
              <DataTable
                headers={["Item Description", "Found Date", "Found By", "Room/Location", "Status", "Claimed By", "Claimed Date", "Contact"]}
                data={lostFoundItems}
                emptyMessage="No lost & found items recorded"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.item_description || '-'}</td>
                    <td className="p-3">{item.found_date ? formatDate(item.found_date) : '-'}</td>
                    <td className="p-3">{item.found_by || item.found_by_employee || '-'}</td>
                    <td className="p-3">
                      {item.room_number ? `Room ${item.room_number}` : (item.location || '-')}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'claimed' ? 'bg-green-100 text-green-800' :
                          item.status === 'disposed' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                        {item.status || 'found'}
                      </span>
                    </td>
                    <td className="p-3">{item.claimed_by || '-'}</td>
                    <td className="p-3">{item.claimed_date ? formatDate(item.claimed_date) : '-'}</td>
                    <td className="p-3">{item.claimed_contact || '-'}</td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
        );

      case 'asset-audit':
        const assetAuditData = data?.asset_audit || [];
        const totalAssets = data?.total || 0;

        const handleRaiseService = async (asset) => {
          try {
            // Try to find a room by location
            let roomId = null;
            const locationName = asset.mapped_location || asset.location;

            if (locationName && asset.location_id) {
              // Try to find a room with matching inventory_location_id
              const roomsResponse = await API.get(`/rooms?skip=0&limit=100`);
              const rooms = roomsResponse.data || [];
              const matchingRoom = rooms.find(room => room.inventory_location_id === asset.location_id);
              if (matchingRoom) {
                roomId = matchingRoom.id;
              }
            }

            // If no matching room found, use the first available room
            if (!roomId) {
              const roomsResponse = await API.get('/rooms?skip=0&limit=1');
              const rooms = roomsResponse.data || [];
              roomId = rooms.length > 0 ? rooms[0].id : null;
            }

            if (!roomId) {
              alert('No rooms available. Please create a room first.');
              return;
            }

            const serviceRequest = {
              room_id: roomId,
              request_type: 'service',
              description: `Service request for asset: ${asset.asset_name} (${asset.asset_code}) at location: ${locationName || '-'}`
            };

            const response = await API.post('/service-requests', serviceRequest);
            alert(`Service request raised successfully! Request ID: ${response.data?.id || 'N/A'}`);
          } catch (error) {
            console.error('Error raising service request:', error);
            const errorMsg = error.response?.data?.detail || error.message || 'Failed to raise service request';
            alert(`Error: ${errorMsg}`);
          }
        };

        const handleRaiseInventoryAudit = async (asset) => {
          try {
            // Try to find a room by location
            let roomId = null;
            const locationName = asset.mapped_location || asset.location;

            if (locationName && asset.location_id) {
              // Try to find a room with matching inventory_location_id
              const roomsResponse = await API.get(`/rooms?skip=0&limit=100`);
              const rooms = roomsResponse.data || [];
              const matchingRoom = rooms.find(room => room.inventory_location_id === asset.location_id);
              if (matchingRoom) {
                roomId = matchingRoom.id;
              }
            }

            // If no matching room found, use the first available room
            if (!roomId) {
              const roomsResponse = await API.get('/rooms?skip=0&limit=1');
              const rooms = roomsResponse.data || [];
              roomId = rooms.length > 0 ? rooms[0].id : null;
            }

            if (!roomId) {
              alert('No rooms available. Please create a room first.');
              return;
            }

            const auditRequest = {
              room_id: roomId,
              request_type: 'inventory_audit',
              description: `Inventory audit required for asset: ${asset.asset_name} (${asset.asset_code}) at location: ${locationName || '-'}. Status: ${asset.status}. Mapped Location: ${asset.mapped_location || 'N/A'}, Actual Location: ${asset.actual_location || 'N/A'}`
            };

            const response = await API.post('/service-requests', auditRequest);
            alert(`Inventory audit service request created successfully! Request ID: ${response.data?.id || 'N/A'}`);
          } catch (error) {
            console.error('Error raising inventory audit request:', error);
            const errorMsg = error.response?.data?.detail || error.message || 'Failed to raise inventory audit request';
            alert(`Error: ${errorMsg}`);
          }
        };

        const handleRaiseMaintenanceTicket = async (asset) => {
          try {
            // Try to find a room by location
            let roomId = null;
            const locationName = asset.mapped_location || asset.location;

            if (locationName && asset.location_id) {
              // Try to find a room with matching inventory_location_id
              const roomsResponse = await API.get(`/rooms?skip=0&limit=100`);
              const rooms = roomsResponse.data || [];
              const matchingRoom = rooms.find(room => room.inventory_location_id === asset.location_id);
              if (matchingRoom) {
                roomId = matchingRoom.id;
              }
            }

            // If no matching room found, use the first available room
            if (!roomId) {
              const roomsResponse = await API.get('/rooms?skip=0&limit=1');
              const rooms = roomsResponse.data || [];
              roomId = rooms.length > 0 ? rooms[0].id : null;
            }

            if (!roomId) {
              alert('No rooms available. Please create a room first.');
              return;
            }

            const maintenanceRequest = {
              room_id: roomId,
              request_type: 'maintenance',
              description: `Maintenance ticket for asset: ${asset.asset_name} (${asset.asset_code}) at location: ${locationName || '-'}. Status: ${asset.status}`
            };

            await API.post('/service-requests', maintenanceRequest);
            alert('Maintenance ticket raised successfully!');
          } catch (error) {
            console.error('Error raising maintenance ticket:', error);
            alert('Failed to raise maintenance ticket. Please try again.');
          }
        };

        return (
          <div className="space-y-4">
            <SectionCard title="Asset Audit Report" icon={<FileCheck className="text-green-600" />} loading={loading} count={totalAssets}>
              <DataTable
                headers={["Asset Name", "Asset Code", "Mapped Location", "Actual Location", "Status", "Category", "Actions"]}
                data={assetAuditData}
                emptyMessage="No assets found"
                renderRow={(item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-semibold">{item.asset_name}</td>
                    <td className="p-3 font-mono text-sm">{item.asset_code || '-'}</td>
                    <td className="p-3">{item.mapped_location || '-'}</td>
                    <td className="p-3">{item.actual_location || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'Match' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3">{item.category || '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleRaiseInventoryAudit(item)}
                          className="px-3 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
                          title="Create Inventory Audit Service Request"
                        >
                          Audit
                        </button>
                        <button
                          onClick={() => handleRaiseService(item)}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="Raise Service Request"
                        >
                          Service
                        </button>
                        <button
                          onClick={() => handleRaiseMaintenanceTicket(item)}
                          className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
                          title="Raise Maintenance Ticket"
                        >
                          Maintenance
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              />
            </SectionCard>
          </div>
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
                      {typeof item[header] === 'number' && (header.includes('amount') || header.includes('price') || header.includes('total') || header.includes('salary'))
                        ? formatCurrency(item[header])
                        : typeof item[header] === 'string' && item[header].includes('T') && item[header].includes('-')
                          ? formatDate(item[header])
                          : Array.isArray(item[header])
                            ? item[header].join(', ')
                            : (item[header] === null || item[header] === undefined || item[header] === 'N/A' || item[header] === 'na' || item[header] === '')
                              ? '-'
                              : String(item[header])}
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

            {/* Reports List */}
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
