import React, { useState, useEffect, useCallback, memo, useMemo } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import BannerMessage from "../components/BannerMessage";
import axios from "axios"; // We need axios to create the api service object
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, BedDouble, Users, Utensils, Package, Hash, Calendar, CreditCard, X, Search, Filter, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { useNavigate } from "react-router-dom";
import autoTable from 'jspdf-autotable';
// Make sure to place your logo in the specified path or update the path accordingly.
import { useInfiniteScroll } from "./useInfiniteScroll";
import logo from '../assets/logo.jpeg'; 
import { formatCurrency } from '../utils/currency'; 
import { getApiBaseUrl } from "../utils/env";


// --- Placeholder for DashboardLayout ---
// In your actual project, you would remove this and use your own DashboardLayout component.


// --- API service ---
// Using the same API service setup as other pages
const api = axios.create({
  baseURL: getApiBaseUrl(),
});

// 1. Request Interceptor: Attaches the token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

const resolveLoginPath = () => {
  if (typeof window === "undefined") {
    return "/admin/login";
  }
  const path = window.location.pathname || "";
  return path.startsWith("/pommaadmin") ? "/pommaadmin/login" : "/admin/login";
};

// 2. Response Interceptor: Handles 401 errors globally
api.interceptors.response.use(response => {
  return response;
}, error => {
  if (error.response && error.response.status === 401) {
    // Token is invalid or expired
    localStorage.removeItem('token');
    // Use window.location to force a full page reload to clear any stale state
    window.location.href = resolveLoginPath();
    // You could also use a state management solution to show a "Session Expired" message
  }
  return Promise.reject(error);
});


// --- Helper Components ---

const KpiCard = React.memo(({ title, value, icon, color, prefix = '', suffix = '' }) => (
  <div className="bg-white p-4 rounded-xl shadow-md flex items-center">
    <div className={`rounded-full p-3 mr-4 ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{prefix}{value}{suffix}</p>
    </div>
  </div>
));
KpiCard.displayName = 'KpiCard';

const CheckoutDetailModal = React.memo(({ checkout, onClose }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (checkout) {
      setLoading(true);
      api.get(`/bill/checkouts/${checkout.id}/details`)
        .then(response => {
          setDetails(response.data);
        })
        .catch(err => {
          console.error("Failed to load checkout details:", err);
          setDetails(null);
        })
        .finally(() => setLoading(false));
    }
  }, [checkout]);

  if (!checkout) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] p-6 relative animate-fade-in-up overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 z-10">
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Checkout Details (ID: {checkout.id})</h2>
        
        {loading ? (
          <div className="text-center py-8">Loading details...</div>
        ) : details ? (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Guest Name</p>
                <p className="font-semibold">{details.guest_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rooms</p>
                <p className="font-semibold">{details.room_numbers?.join(', ') || details.room_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Checkout Date</p>
                <p className="font-semibold">{new Date(details.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Method</p>
                <p className="font-semibold">{details.payment_method || 'N/A'}</p>
              </div>
              {details.booking_id && (
                <div>
                  <p className="text-sm text-gray-500">Booking ID</p>
                  <p className="font-semibold">{details.booking_id}</p>
                </div>
              )}
              {details.package_booking_id && (
                <div>
                  <p className="text-sm text-gray-500">Package Booking ID</p>
                  <p className="font-semibold">{details.package_booking_id}</p>
                </div>
              )}
            </div>

            {/* Booking Details */}
            {details.booking_details && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Booking Information</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Check-in</p>
                    <p className="font-semibold">{details.booking_details.check_in}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Check-out</p>
                    <p className="font-semibold">{details.booking_details.check_out}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Adults</p>
                    <p className="font-semibold">{details.booking_details.adults}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Children</p>
                    <p className="font-semibold">{details.booking_details.children}</p>
                  </div>
                  {details.booking_details.package_name && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Package</p>
                      <p className="font-semibold">{details.booking_details.package_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Food Orders */}
            {details.food_orders && details.food_orders.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Food Orders</h3>
                <div className="space-y-4">
                  {details.food_orders.map((order, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">Order #{order.id}</p>
                          <p className="text-sm text-gray-500">Room: {order.room_number}</p>
                          <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-indigo-600">{formatCurrency(order.amount)}</p>
                          <p className="text-sm text-gray-500">{order.status}</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        {order.items?.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between text-sm">
                            <span>{item.item_name} x {item.quantity}</span>
                            <span className="font-medium">{formatCurrency(item.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Services */}
            {details.services && details.services.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Services</h3>
                <div className="space-y-2">
                  {details.services.map((service, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                      <div>
                        <p className="font-semibold">{service.service_name}</p>
                        <p className="text-sm text-gray-500">Room: {service.room_number}</p>
                        {service.created_at && (
                          <p className="text-xs text-gray-400">{new Date(service.created_at).toLocaleString()}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-indigo-600">{formatCurrency(service.charges)}</p>
                        <p className="text-sm text-gray-500">{service.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bill Summary */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3">Bill Summary</h3>
              <div className="space-y-2">
                {details.room_total > 0 && (
                  <div className="flex justify-between">
                    <span>Room Charges:</span>
                    <span className="font-medium">{formatCurrency(details.room_total)}</span>
                  </div>
                )}
                {details.package_total > 0 && (
                  <div className="flex justify-between">
                    <span>Package Charges:</span>
                    <span className="font-medium">{formatCurrency(details.package_total)}</span>
                  </div>
                )}
                {details.food_total > 0 && (
                  <div className="flex justify-between">
                    <span>Food Charges:</span>
                    <span className="font-medium">{formatCurrency(details.food_total)}</span>
                  </div>
                )}
                {details.service_total > 0 && (
                  <div className="flex justify-between">
                    <span>Service Charges:</span>
                    <span className="font-medium">{formatCurrency(details.service_total)}</span>
                  </div>
                )}
                {details.tax_amount > 0 && (
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span className="font-medium">{formatCurrency(details.tax_amount)}</span>
                  </div>
                )}
                {details.discount_amount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Discount:</span>
                    <span className="font-medium">-{formatCurrency(details.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-indigo-600 pt-2 border-t">
                  <span>Grand Total:</span>
                  <span>{formatCurrency(details.grand_total)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">Failed to load details</div>
        )}
      </div>
    </div>
  );
});
CheckoutDetailModal.displayName = 'CheckoutDetailModal';

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6'];


const Billing = () => {
  const navigate = useNavigate(); // Not used here, but good practice if you use react-router for navigation
  const [roomNumber, setRoomNumber] = useState("");
  const [checkoutMode, setCheckoutMode] = useState("multiple");
  const [billData, setBillData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Card");
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState({ type: null, text: "" });
  const [activeRooms, setActiveRooms] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  const [hasMoreCheckouts, setHasMoreCheckouts] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [guestNameFilter, setGuestNameFilter] = useState("");
  const [roomNumberFilter, setRoomNumberFilter] = useState("");
  const [bookingIdFilter, setBookingIdFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  // Function to show banner message
  const showBannerMessage = (type, text) => {
    setBannerMessage({ type, text });
  };

  const closeBannerMessage = () => {
    setBannerMessage({ type: null, text: "" });
  };

  const loadMoreCheckouts = useCallback(async () => {
    if (isFetchingMore || !hasMoreCheckouts) return;
    setIsFetchingMore(true);
    try {
      const response = await api.get(`/bill/checkouts?skip=${checkouts.length}&limit=20`);
      const newCheckouts = response.data || [];
      setCheckouts(prev => [...prev, ...newCheckouts]);
      if (newCheckouts.length < 20) {
        setHasMoreCheckouts(false);
      }
    } catch (err) {
      console.error("Failed to load more checkouts:", err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMoreCheckouts, checkouts.length]);

  const loadMoreRef = useInfiniteScroll(loadMoreCheckouts, hasMoreCheckouts, isFetchingMore);
  const [kpiData, setKpiData] = useState({
    checkouts_today: 0,
    checkouts_total: 0,
    available_rooms: 0,
    booked_rooms: 0,
    food_revenue_today: 0,
    package_bookings_today: 0,
  });

  const [chartData, setChartData] = useState({
    revenue_breakdown: [],
    weekly_performance: [],
  });

  // Extract unique payment methods from checkouts
  const paymentMethods = useMemo(() => {
    const methods = new Set();
    checkouts.forEach(c => {
      if (c.payment_method) methods.add(c.payment_method);
    });
    return Array.from(methods).sort();
  }, [checkouts]);

  // Filter checkouts based on all filter criteria
  const filteredCheckouts = useMemo(() => {
    return checkouts.filter(c => {
      // General search - search across ID, guest name, room number, booking ID
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = 
          c.id.toString().toLowerCase().includes(searchLower) ||
          c.guest_name?.toLowerCase().includes(searchLower) ||
          c.room_number?.toLowerCase().includes(searchLower) ||
          c.booking_id?.toString().toLowerCase().includes(searchLower) ||
          c.package_booking_id?.toString().toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Guest name filter
      if (guestNameFilter && !c.guest_name?.toLowerCase().includes(guestNameFilter.toLowerCase())) {
        return false;
      }

      // Room number filter
      if (roomNumberFilter && !c.room_number?.toLowerCase().includes(roomNumberFilter.toLowerCase())) {
        return false;
      }

      // Booking ID filter
      if (bookingIdFilter) {
        const bookingIdStr = bookingIdFilter.toLowerCase();
        const matchesBookingId = 
          c.booking_id?.toString().toLowerCase().includes(bookingIdStr) ||
          c.package_booking_id?.toString().toLowerCase().includes(bookingIdStr);
        if (!matchesBookingId) return false;
      }

      // Payment method filter
      if (paymentMethodFilter !== "All" && c.payment_method !== paymentMethodFilter) {
        return false;
      }

      // Date range filter
      if (fromDate || toDate) {
        const checkoutDate = new Date(c.created_at);
        if (fromDate && checkoutDate < new Date(fromDate)) return false;
        if (toDate && checkoutDate > new Date(toDate + 'T23:59:59')) return false;
      }

      // Amount range filter
      if (minAmount && c.grand_total < parseFloat(minAmount)) return false;
      if (maxAmount && c.grand_total > parseFloat(maxAmount)) return false;

      return true;
    });
  }, [checkouts, searchQuery, guestNameFilter, roomNumberFilter, bookingIdFilter, paymentMethodFilter, fromDate, toDate, minAmount, maxAmount]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (guestNameFilter) count++;
    if (roomNumberFilter) count++;
    if (bookingIdFilter) count++;
    if (paymentMethodFilter !== "All") count++;
    if (fromDate) count++;
    if (toDate) count++;
    if (minAmount) count++;
    if (maxAmount) count++;
    return count;
  }, [searchQuery, guestNameFilter, roomNumberFilter, bookingIdFilter, paymentMethodFilter, fromDate, toDate, minAmount, maxAmount]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("");
    setGuestNameFilter("");
    setRoomNumberFilter("");
    setBookingIdFilter("");
    setPaymentMethodFilter("All");
    setFromDate("");
    setToDate("");
    setMinAmount("");
    setMaxAmount("");
  };

  // Fetch initial data on component mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // Fetch all necessary data in parallel using Promise.allSettled to handle individual failures
      const results = await Promise.allSettled([
        api.get("/bill/checkouts?skip=0&limit=20").catch(err => ({ error: err, data: [] })),
        api.get("/dashboard/kpis").catch(err => ({ error: err, data: [{ checkouts_today: 0, checkouts_total: 0, available_rooms: 0, booked_rooms: 0, food_revenue_today: 0, package_bookings_today: 0 }] })),
        api.get("/dashboard/charts").catch(err => ({ error: err, data: { revenue_breakdown: [], weekly_performance: [] } })),
        api.get("/bill/active-rooms").catch(err => ({ error: err, data: [] }))
      ]);

      // Process checkouts result
      if (results[0].status === 'fulfilled' && !results[0].value.error) {
        setCheckouts(Array.isArray(results[0].value.data) ? results[0].value.data : []);
        setHasMoreCheckouts(results[0].value.data && results[0].value.data.length === 20);
      } else {
        console.error("Failed to load checkouts:", results[0].value?.error || results[0].reason);
        setCheckouts([]);
        setHasMoreCheckouts(false);
      }

      // Process KPI result
      if (results[1].status === 'fulfilled' && !results[1].value.error) {
        const kpiData = results[1].value.data;
        if (Array.isArray(kpiData) && kpiData.length > 0) {
          setKpiData(kpiData[0]);
        } else if (typeof kpiData === 'object') {
          setKpiData(kpiData);
        } else {
          setKpiData({
            checkouts_today: 0,
            checkouts_total: 0,
            available_rooms: 0,
            booked_rooms: 0,
            food_revenue_today: 0,
            package_bookings_today: 0,
          });
        }
      } else {
        console.error("Failed to load KPIs:", results[1].value?.error || results[1].reason);
        setKpiData({
          checkouts_today: 0,
          checkouts_total: 0,
          available_rooms: 0,
          booked_rooms: 0,
          food_revenue_today: 0,
          package_bookings_today: 0,
        });
      }

      // Process charts result
      if (results[2].status === 'fulfilled' && !results[2].value.error) {
        setChartData(results[2].value.data || { revenue_breakdown: [], weekly_performance: [] });
      } else {
        console.error("Failed to load charts:", results[2].value?.error || results[2].reason);
        setChartData({ revenue_breakdown: [], weekly_performance: [] });
      }

      // Process active rooms result
      if (results[3].status === 'fulfilled' && !results[3].value.error) {
        const roomsData = Array.isArray(results[3].value.data) ? results[3].value.data : [];
        console.log("Active rooms fetched:", roomsData);
        setActiveRooms(roomsData);
        if (roomsData.length === 0) {
          console.warn("No active rooms found. This could mean:");
          console.warn("1. No bookings are in 'checked-in' status");
          console.warn("2. All rooms in checked-in bookings are already marked as 'Available' (checked out)");
          console.warn("3. There are no active bookings");
        }
      } else {
        console.error("Failed to load active rooms:", results[3].value?.error || results[3].reason);
        setActiveRooms([]);
      }

      // Show error message only if all requests failed
      const allFailed = results.every(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error));
      if (allFailed) {
        showBannerMessage("error", "Could not fetch dashboard data. Please check your connection and try again.");
      }
    } catch (err) {
      console.error("Unexpected error fetching initial data:", err);
      showBannerMessage("error", `Could not fetch dashboard data: ${err.message || 'Unknown error'}. Please refresh.`);
      // Set default values to prevent undefined errors
      setCheckouts([]);
      setActiveRooms([]);
      setKpiData({
        checkouts_today: 0,
        checkouts_total: 0,
        available_rooms: 0,
        booked_rooms: 0,
        food_revenue_today: 0,
        package_bookings_today: 0,
      });
      setChartData({
        revenue_breakdown: [],
        weekly_performance: []
      });
    }
  };

  const handleGetBill = async () => {
    if (!roomNumber) {
      showBannerMessage("error", "Please select a booking to checkout.");
      return;
    }
    setLoading(true);
    setBillData(null);
    setDiscount(0); // Reset discount when fetching a new bill
    try {
      // Extract actual room number from composite key if needed
      const actualRoomNumber = roomNumber.includes('-') ? roomNumber.split('-')[1] : roomNumber;
      const res = await api.get(`/bill/${actualRoomNumber}?checkout_mode=${checkoutMode}`);
      if (res.data && res.data.room_numbers) {
      setBillData(res.data);
        const roomCount = res.data.room_numbers.length;
        const modeText = checkoutMode === "single" ? "single room" : "all rooms in the booking";
        showBannerMessage("success", `Bill retrieved for ${roomCount} room(s) (${modeText}).`);
      } else {
        throw new Error("Invalid bill data received");
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : (error.message || 'Unknown error');
      showBannerMessage("error", `Error: ${message}`);
      setBillData(null);
      console.error("Error fetching bill:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!billData) {
      showBannerMessage("error", "Please retrieve the bill before checkout.");
      return;
    }
    if (!roomNumber) {
      showBannerMessage("error", "No booking selected for checkout.");
      return;
    }
    // Validate discount amount
    const discountAmount = parseFloat(discount) || 0;
    if (discountAmount < 0) {
      showBannerMessage("error", "Discount amount cannot be negative.");
      return;
    }
    const totalWithGST = billData.charges.total_due + (billData.charges.total_gst || 0);
    if (discountAmount > totalWithGST) {
      showBannerMessage("error", "Discount cannot exceed the grand total.");
      return;
    }
    setLoading(true);
    try {
      // Extract actual room number from composite key if needed
      const actualRoomNumber = roomNumber.includes('-') ? roomNumber.split('-')[1] : roomNumber;
      const res = await api.post(`/bill/checkout/${actualRoomNumber}`, {
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        checkout_mode: checkoutMode,
      });
      const roomCount = billData.room_numbers?.length || 1;
      const modeText = checkoutMode === "single" ? "single room" : "all rooms";
      setBillData(null);
      setDiscount(0);
      setRoomNumber(""); // Clear input on successful checkout
      setCheckoutMode("multiple"); // Reset to default
      showBannerMessage("success", `Checkout successful! ${roomCount} room(s) (${modeText}) checked out. Checkout ID: ${res.data.checkout_id}`);
      // Refresh all data after successful checkout
      setTimeout(() => {
        fetchInitialData();
      }, 1000);
    } catch (error) {
      const errorMessage = error.response?.data?.detail || error.message || "Checkout failed";
      
      // If it's a conflict error, it means it's already checked out. Show a clearer message.
      if (error.response?.status === 409) {
        const conflictMessage = errorMessage.includes("already") 
          ? errorMessage 
          : `This booking or room has already been checked out. ${errorMessage}`;
        showBannerMessage("error", conflictMessage);
        setBillData(null);
        setDiscount(0);
        setRoomNumber("");
        // Refresh active rooms list immediately
        fetchInitialData();
      } else if (error.response?.status === 404) {
        // Booking not found - might have been checked out already
        showBannerMessage("error", "Booking not found. It may have already been checked out. Refreshing...");
        setBillData(null);
        setRoomNumber("");
        fetchInitialData();
      } else {
        showBannerMessage("error", `Error: ${errorMessage}`);
      }
      console.error("Checkout error:", error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (action = 'print') => {
    if (!billData) return;

    const doc = new jsPDF();

    // 1. Add Logo and Hotel Info
    doc.addImage(logo, 'PNG', 14, 15, 30, 15); // Adjust position and size as needed
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('Resort Invoice', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Your Resort Name', 190, 20, { align: 'right' });
    doc.text('123 Paradise Lane, Beach City', 190, 25, { align: 'right' });
    doc.text('contact@yourresort.com', 190, 30, { align: 'right' });

    // 2. Bill Details
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', 14, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(billData.guest_name, 14, 51);
    doc.text(`Rooms: ${billData.room_numbers.join(', ')}`, 14, 57);

    doc.setFont('helvetica', 'bold');
    doc.text('Check-in:', 130, 45);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(billData.check_in).toLocaleDateString(), 150, 45);
    doc.setFont('helvetica', 'bold');
    doc.text('Check-out:', 130, 51);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(billData.check_out).toLocaleDateString(), 150, 51);

    // 3. Itemized Charges Table
    const chargesBody = [];
    if (billData.charges.room_charges > 0) chargesBody.push(['Room Charges', `Stay for ${billData.stay_nights} nights`, formatCurrency(billData.charges.room_charges)]);
    if (billData.charges.package_charges > 0) chargesBody.push(['Package Charges', `Package for ${billData.stay_nights} nights`, formatCurrency(billData.charges.package_charges)]);
    billData.charges.food_items.forEach(item => chargesBody.push([`Food: ${item.item_name}`, `Quantity: ${item.quantity}`, formatCurrency(item.amount)]));
    billData.charges.service_items.forEach(item => chargesBody.push([`Service: ${item.service_name}`, '', formatCurrency(item.charges)]));

    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Details', 'Amount']],
      body: chargesBody,
      theme: 'striped',
      headStyles: { fillColor: [38, 41, 61] } // Dark blue color
    });

    // 4. Totals with GST breakdown
    const subtotal = billData.charges.total_due;
    const totalGST = billData.charges.total_gst || 0;
    const grandTotal = Math.max(0, subtotal + totalGST - (parseFloat(discount) || 0));
    const totals = [
      ['Subtotal', formatCurrency(subtotal)],
      ...(billData.charges.room_gst > 0 ? [['Room GST', `+${formatCurrency(billData.charges.room_gst || 0)}`]] : []),
      ...(billData.charges.package_gst > 0 ? [['Package GST', `+${formatCurrency(billData.charges.package_gst || 0)}`]] : []),
      ...(billData.charges.food_gst > 0 ? [['Food GST (5%)', `+${formatCurrency(billData.charges.food_gst || 0)}`]] : []),
      ['Total GST', `+${formatCurrency(totalGST)}`],
      ...(discount > 0 ? [['Discount', `-${formatCurrency(parseFloat(discount))}`]] : []),
      ['Grand Total', formatCurrency(grandTotal)]
    ];

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 2,
      body: totals,
      theme: 'plain',
      tableWidth: 'wrap',
      margin: { left: 120 },
      styles: { cellPadding: 1.5, fontSize: 11 },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'right' },
        1: { fontStyle: 'bold', halign: 'right' }
      },
      didParseCell: (data) => {
        if (data.row.index === totals.length - 1) { // Grand Total row
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 14;
        }
      }
    });

    // 5. Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text('Thank you for staying with us!', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // 6. Perform action
    if (action === 'print') {
      doc.autoPrint();
      doc.output('dataurlnewwindow'); // Opens PDF in new window with print dialog
    } else {
      doc.save(`bill-room-${billData.room_numbers.join('-')}.pdf`); // Downloads the file
    }
  };

  const generateBillText = (forWhatsApp = false) => {
    if (!billData) return "";

    const line = '----------------------------------------';
    const bold = (text) => forWhatsApp ? `*${text}*` : text.toUpperCase();

    let text = `${bold('Hotel Checkout Bill')}\n${line}\n`;
    text += `Guest Name: ${billData.guest_name}\n`;
    text += `Rooms: ${billData.room_numbers.join(', ')}\n`;
    text += `Check-in: ${new Date(billData.check_in).toLocaleDateString()}\n`;
    text += `Check-out: ${new Date(billData.check_out).toLocaleDateString()}\n`;
    text += `${line}\n`;
    text += `${bold('Itemized Charges:')}\n`;
    if (billData.charges.room_charges > 0) text += `Room Charges: ${formatCurrency(billData.charges.room_charges)}\n`;
    if (billData.charges.package_charges > 0) text += `Package Charges: ${formatCurrency(billData.charges.package_charges)}\n`;

    if (billData.charges.food_items.length > 0) {
      text += `\nFood & Beverage:\n`;
      billData.charges.food_items.forEach(item => {
        text += `- ${item.item_name} (x${item.quantity}): ${formatCurrency(item.amount)}\n`;
      });
    }
    if (billData.charges.service_items.length > 0) {
      text += `\nAdditional Services:\n`;
      billData.charges.service_items.forEach(item => {
        text += `- ${item.service_name}: ${formatCurrency(item.charges)}\n`;
      });
    }
    text += `${line}\n`;
    text += `Subtotal: ${formatCurrency(billData.charges.total_due)}\n`;
    // GST Breakdown
    if (billData.charges.room_gst > 0) {
      const gstRate = billData.charges.room_charges <= 7500 ? '12%' : '18%';
      text += `Room GST (${gstRate}): +${formatCurrency(billData.charges.room_gst || 0)}\n`;
    }
    if (billData.charges.package_gst > 0) {
      const gstRate = billData.charges.package_charges <= 7500 ? '12%' : '18%';
      text += `Package GST (${gstRate}): +${formatCurrency(billData.charges.package_gst || 0)}\n`;
    }
    if (billData.charges.food_gst > 0) {
      text += `Food GST (5%): +${formatCurrency(billData.charges.food_gst || 0)}\n`;
    }
    text += `Total GST: +${formatCurrency(billData.charges.total_gst || 0)}\n`;
    if (discount > 0) text += `Discount: -${formatCurrency(parseFloat(discount))}\n`;
    text += `${bold('Grand Total:')} ${formatCurrency(Math.max(0, billData.charges.total_due + (billData.charges.total_gst || 0) - discount))}\n`;
    text += `${line}\nThank you for staying with us!`;

    return encodeURIComponent(text);
  };

  const handleWhatsAppShare = () => {
    const billText = generateBillText(true);
    window.open(`https://wa.me/?text=${billText}`, '_blank');
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`Your Hotel Bill for Room(s) ${billData.room_numbers.join(', ')}`);
    const body = generateBillText(false);
    // This will open the user's default email client. For GMail specifically:
    // window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, '_blank');
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <DashboardLayout>
      <BannerMessage 
        message={bannerMessage} 
        onClose={closeBannerMessage}
        autoDismiss={true}
        duration={5000}
      />
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

      <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">Business Dashboard & Checkout</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <KpiCard title="Checkouts Today" value={kpiData.checkouts_today} icon={<Hash size={22} className="text-indigo-600"/>} color="bg-indigo-100" />
          <KpiCard title="Total Checkouts" value={kpiData.checkouts_total} icon={<Hash size={22} className="text-green-600"/>} color="bg-green-100" />
          <KpiCard title="Available Rooms" value={kpiData.available_rooms} icon={<BedDouble size={22} className="text-blue-600"/>} color="bg-blue-100" />
          <KpiCard title="Booked Rooms" value={kpiData.booked_rooms} icon={<BedDouble size={22} className="text-red-600"/>} color="bg-red-100" />
          <KpiCard title="Food Revenue Today" value={kpiData.food_revenue_today.toLocaleString()} prefix="₹" icon={<Utensils size={22} className="text-yellow-600"/>} color="bg-yellow-100" />
          <KpiCard title="Package Bookings Today" value={kpiData.package_bookings_today} icon={<Package size={22} className="text-purple-600"/>} color="bg-purple-100" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 md:gap-8 mb-6 sm:mb-8">
          <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Weekly Performance</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.weekly_performance} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis dataKey="day" stroke="#6b7280" />
                <YAxis yAxisId="left" stroke="#6b7280" />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" fill="#4f46e5" name="Revenue (₹)" />
                <Bar yAxisId="right" dataKey="checkouts" fill="#10b981" name="Checkouts" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Total Revenue Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData.revenue_breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {chartData.revenue_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Checkout Form */}
        <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl shadow-md w-full max-w-2xl mx-auto mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-center text-gray-800 mb-4 sm:mb-6">Process New Checkout</h2>
          <div className="mb-4">
            <label htmlFor="room-select" className="block text-gray-700 font-medium mb-2">
              Select a Room or Booking to Checkout
            </label>
            <select
              id="room-select"
              value={roomNumber}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) {
                  setRoomNumber("");
                  setCheckoutMode("multiple");
                  setBillData(null);
                  return;
                }
                // Use composite key: booking_id-room_number-checkout_mode
                const parts = value.split('-');
                if (parts.length >= 3) {
                  const [bookingId, roomNum, mode] = parts;
                  const selected = activeRooms.find(b => 
                    b.booking_id.toString() === bookingId && 
                    b.room_number === roomNum && 
                    b.checkout_mode === mode
                  );
                  setRoomNumber(value);
                  if (selected) {
                    setCheckoutMode(selected.checkout_mode || mode || "multiple");
                    setBillData(null); // Clear bill data when selection changes
                  }
                } else {
                  // Fallback for old format (shouldn't happen, but just in case)
                  const selected = activeRooms.find(b => b.room_number === value);
                  setRoomNumber(value);
                  if (selected) {
                    setCheckoutMode(selected.checkout_mode || "multiple");
                    setBillData(null);
                  }
                }
              }}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select a Room or Booking to Checkout --</option>
              {activeRooms.map((booking, index) => {
                // Create unique composite key: booking_id-room_number-checkout_mode
                const uniqueValue = `${booking.booking_id}-${booking.room_number}-${booking.checkout_mode}`;
                return (
                  <option key={`${uniqueValue}-${index}`} value={uniqueValue}>
                    {booking.display_label || `${booking.room_numbers?.join(', ') || booking.room_number} (${booking.guest_name})`}
                </option>
                );
              })}
            </select>
            {roomNumber && (() => {
              // Parse composite key to find the correct selection
              let selected = null;
              let actualMode = "multiple";
              
              if (roomNumber.includes('-')) {
                const parts = roomNumber.split('-');
                if (parts.length >= 3) {
                  const [bookingId, roomNum, mode] = parts;
                  selected = activeRooms.find(b => 
                    b.booking_id.toString() === bookingId && 
                    b.room_number === roomNum && 
                    b.checkout_mode === mode
                  );
                  actualMode = selected?.checkout_mode || mode || "multiple";
                }
              } else {
                // Fallback for old format
                selected = activeRooms.find(b => b.room_number === roomNumber);
                actualMode = selected?.checkout_mode || "multiple";
              }
              
              const isMultiple = actualMode === "multiple";
              return (
                <div className={`mt-2 p-3 ${isMultiple ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-lg text-sm ${isMultiple ? 'text-blue-800' : 'text-green-800'}`}>
                  <p className="font-semibold">
                    {isMultiple ? "⚠️ Important: This will checkout ALL rooms in the booking" : "✓ Single Room Checkout: Only this room will be checked out"}
                  </p>
                  <p className="mt-1">Rooms: {selected?.room_numbers?.join(', ') || roomNumber}</p>
                  {selected?.room_numbers && selected.room_numbers.length > 1 && !isMultiple && (
                    <p className="mt-1 text-xs italic">Other rooms in this booking will remain checked in.</p>
                  )}
                </div>
              );
            })()}
          </div>
          <button
            onClick={handleGetBill}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mb-4"
            disabled={loading}
          >
            {loading ? "Fetching Bill..." : checkoutMode === "single" ? "Get Bill for Single Room" : "Get Bill for Entire Booking"}
          </button>

          {billData && (
            <div id="bill-details" className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 animate-fade-in">
              <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Detailed Bill</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4 text-sm">
                <p><span className="font-semibold">Guest Name:</span> {billData.guest_name}</p>
                <p><span className="font-semibold">Rooms:</span> {billData.room_numbers.join(', ')} ({billData.room_numbers.length})</p>
                <p><span className="font-semibold">Check-in:</span> {new Date(billData.check_in).toLocaleDateString()}</p>
                <p><span className="font-semibold">Check-out:</span> {new Date(billData.check_out).toLocaleDateString()}</p>
                <p><span className="font-semibold">Stay:</span> {billData.stay_nights} nights</p>
                <p><span className="font-semibold">Guests:</span> {billData.number_of_guests}</p>
              </div>
              
              <div className="mt-4 pt-4 border-t">
                <h3 className="font-bold text-gray-700 mb-2">Itemized Charges:</h3>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {billData.charges.room_charges > 0 && <li>Room Charges: {formatCurrency(billData.charges.room_charges)}</li>}
                  {billData.charges.package_charges > 0 && <li>Package Charges: {formatCurrency(billData.charges.package_charges)}</li>}
                </ul>

                {billData.charges.food_items.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-semibold text-gray-600">Food & Beverage:</h4>
                    <ul className="list-decimal list-inside ml-4 text-xs text-gray-500">
                      {billData.charges.food_items.map((item, i) => <li key={i}>{item.item_name} (x{item.quantity}) - {formatCurrency(item.amount)}</li>)}
                    </ul>
                  </div>
                )}

                {billData.charges.service_items.length > 0 && (
                  <div className="mt-3">
                    <h4 className="font-semibold text-gray-600">Additional Services:</h4>
                    <ul className="list-decimal list-inside ml-4 text-xs text-gray-500">
                      {billData.charges.service_items.map((item, i) => <li key={i}>{item.service_name} - {formatCurrency(item.charges)}</li>)}
                    </ul>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t text-right space-y-1">
                  <p className="text-sm text-gray-600">Subtotal: {formatCurrency(billData.charges.total_due)}</p>
                  {/* GST Breakdown */}
                  {billData.charges.room_gst > 0 && (
                    <p className="text-xs text-gray-500">Room GST ({
                      billData.charges.room_charges < 5000 ? '5%' : 
                      billData.charges.room_charges <= 7500 ? '12%' : '18%'
                    }): +{formatCurrency(billData.charges.room_gst || 0)}</p>
                  )}
                  {billData.charges.package_gst > 0 && (
                    <p className="text-xs text-gray-500">Package GST ({
                      billData.charges.package_charges < 5000 ? '5%' : 
                      billData.charges.package_charges <= 7500 ? '12%' : '18%'
                    }): +{formatCurrency(billData.charges.package_gst || 0)}</p>
                  )}
                  {billData.charges.food_gst > 0 && (
                    <p className="text-xs text-gray-500">Food GST (5%): +{formatCurrency(billData.charges.food_gst || 0)}</p>
                  )}
                  <p className="text-sm text-gray-600 font-semibold">Total GST: +{formatCurrency(billData.charges.total_gst || 0)}</p>
                  {discount > 0 && (
                    <p className="text-sm text-green-600">Discount: -{formatCurrency(parseFloat(discount))}</p>
                  )}
                  <p className="font-bold text-xl text-gray-900">
                    Grand Total: {formatCurrency(Math.max(0, billData.charges.total_due + (billData.charges.total_gst || 0) - discount))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {billData && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="discount" className="block text-gray-700 font-medium mb-2">Discount (₹)</label>
                  <input type="number" id="discount" value={discount} onChange={e => setDiscount(e.target.value)} className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                </div>
                <div>
                  <label htmlFor="payment-method" className="block text-gray-700 font-medium mb-2">Payment Method</label>
                  <select
                    id="payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg h-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Card">Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex space-x-2">
                   <button onClick={() => generatePDF('print')} className="flex-1 bg-gray-500 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 transition">Print</button>
                   <button onClick={() => generatePDF('download')} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg font-semibold hover:bg-indigo-600 transition">Download</button>
                   <button onClick={handleWhatsAppShare} className="flex-1 bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition">WhatsApp</button>
                   <button onClick={handleEmailShare} className="flex-1 bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition">Email</button>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-red-700 transition duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Complete Checkout"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* All Checkouts Report */}
        <div className="bg-white p-3 sm:p-6 rounded-xl shadow-md w-full max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Completed Checkouts</h2>
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Showing {filteredCheckouts.length} of {checkouts.length} checkouts</span>
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <XCircle size={14} />
                  Clear Filters ({activeFiltersCount})
                </button>
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={18} className="text-indigo-600" />
              <h3 className="font-semibold text-gray-800">Filters & Search</h3>
            </div>
            
            {/* General Search */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by ID, guest name, room number, booking ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Filter Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Guest Name Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                <input
                  type="text"
                  value={guestNameFilter}
                  onChange={(e) => setGuestNameFilter(e.target.value)}
                  placeholder="Filter by guest name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Room Number Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number</label>
                <input
                  type="text"
                  value={roomNumberFilter}
                  onChange={(e) => setRoomNumberFilter(e.target.value)}
                  placeholder="Filter by room number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Booking/Package ID Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Booking/Package ID</label>
                <input
                  type="text"
                  value={bookingIdFilter}
                  onChange={(e) => setBookingIdFilter(e.target.value)}
                  placeholder="Filter by booking ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Payment Method Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                >
                  <option value="All">All Methods</option>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Range and Amount Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {/* From Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Min Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (₹)</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>

              {/* Max Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (₹)</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="No limit"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full text-xs sm:text-sm text-left">
              <thead className="bg-gray-50 border-b-2 border-gray-200 text-gray-800 uppercase tracking-wider">
                <tr>
                  <th className="p-2 sm:p-3">ID</th>
                  <th className="p-2 sm:p-3 hidden sm:table-cell">Guest</th>
                  <th className="p-2 sm:p-3">Rooms</th>
                  <th className="p-2 sm:p-3 hidden lg:table-cell">Booking/Package ID</th>
                  <th className="p-2 sm:p-3 hidden md:table-cell">Payment</th>
                  <th className="p-2 sm:p-3 hidden lg:table-cell">Date</th>
                  <th className="p-2 sm:p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCheckouts.length > 0 ? (
                  filteredCheckouts.map((c) => (
                    <tr key={c.id} className="hover:bg-indigo-50 cursor-pointer" onClick={() => setSelectedCheckout(c)}>
                      <td className="p-2 sm:p-3 font-medium text-gray-800 text-xs sm:text-sm">{c.id}</td>
                      <td className="p-2 sm:p-3 font-semibold text-gray-900 text-xs sm:text-sm hidden sm:table-cell">{c.guest_name}</td>
                      <td className="p-2 sm:p-3 text-gray-800 text-xs sm:text-sm">{c.room_number}</td>
                      <td className="p-2 sm:p-3 text-gray-800 text-xs sm:text-sm hidden lg:table-cell">{c.booking_id || c.package_booking_id || 'N/A'}</td>
                      <td className="p-2 sm:p-3 text-gray-800 text-xs sm:text-sm hidden md:table-cell">{c.payment_method}</td>
                      <td className="p-2 sm:p-3 text-gray-800 text-xs sm:text-sm hidden lg:table-cell">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="p-2 sm:p-3 font-bold text-gray-900 text-right text-xs sm:text-sm">{formatCurrency(c.grand_total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-4 text-center text-gray-500 text-sm sm:text-base">
                      {activeFiltersCount > 0 ? (
                        <div className="flex flex-col items-center gap-2">
                          <span>No checkouts match your filters.</span>
                          <button
                            onClick={clearAllFilters}
                            className="text-indigo-600 hover:text-indigo-800 underline text-sm"
                          >
                            Clear all filters
                          </button>
                        </div>
                      ) : (
                        "No completed checkouts found."
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
            {hasMoreCheckouts && (
              <div ref={loadMoreRef} className="text-center p-4">
                {isFetchingMore && <span className="text-indigo-600">Loading more checkouts...</span>}
              </div>
            )}
        </div>

        <CheckoutDetailModal checkout={selectedCheckout} onClose={() => setSelectedCheckout(null)} />
      </div>
    </DashboardLayout>
  );
};



export default Billing;
