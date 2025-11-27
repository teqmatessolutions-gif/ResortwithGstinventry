import React, { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import { Bar, Line } from "react-chartjs-2";
import "chart.js/auto";

export default function FoodOrders() {
  const [orders, setOrders] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [roomId, setRoomId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      // Fetch initial page of orders, rooms, bookings, and other data
      const [ordersRes, roomsRes, employeesRes, foodItemsRes, bookingsRes, packageBookingsRes] = await Promise.all([
        api.get("/food-orders/?skip=0&limit=20"),
        api.get("/rooms?limit=1000").catch(err => {
          console.error("Error fetching rooms:", err);
          return { data: [] };
        }),
        api.get("/employees/").catch(err => {
          console.error("Error fetching employees:", err);
          return { data: [] };
        }),
        api.get("/food-items/").catch(err => {
          console.error("Error fetching food items:", err);
          return { data: [] };
        }),
        api.get("/bookings?limit=1000").catch(err => {
          console.error("Error fetching bookings:", err);
          return { data: { bookings: [] } };
        }),
        api.get("/packages/bookingsall?limit=1000").catch(err => {
          console.error("Error fetching package bookings:", err);
          return { data: [] };
        }),
      ]);
      setOrders(ordersRes.data);
      setHasMore(ordersRes.data.length === 12);
      setEmployees(employeesRes.data);
      setFoodItems(foodItemsRes.data);
      
      // Filter rooms to only show checked-in rooms (similar to Services page)
      const allRooms = roomsRes.data;
      const regularBookings = bookingsRes.data?.bookings || [];
      const packageBookings = (packageBookingsRes.data || []).map(pb => ({ ...pb, is_package: true }));
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkedInRoomIds = new Set();
      
      // Helper function to normalize status
      const normalizeStatus = (status) => {
        if (!status) return '';
        return status.toLowerCase().replace(/[-_\s]/g, '');
      };
      
      // Helper function to check if status is checked-in or booked (active booking)
      const isActiveBooking = (status) => {
        if (!status) return false;
        const normalized = status.toLowerCase().replace(/[-_\s]/g, '');
        // Accept: 'checkedin', 'checked-in', 'checked_in', 'checked in', or 'booked' (for active bookings)
        // Exclude: 'cancelled', 'checkedout', 'checked-out', 'checked_out'
        return (normalized === 'checkedin' || normalized === 'booked') && 
               normalized !== 'cancelled' && 
               !normalized.includes('checkedout');
      };
      
      // Get room IDs from active regular bookings (checked-in or booked, not cancelled)
      regularBookings.forEach(booking => {
        if (isActiveBooking(booking.status)) {
          // Parse dates properly
          const checkInDate = new Date(booking.check_in);
          const checkOutDate = new Date(booking.check_out);
          checkInDate.setHours(0, 0, 0, 0);
          checkOutDate.setHours(0, 0, 0, 0);
          
          // Check if booking is active (today is between check-in and check-out)
          // Also allow if check-out is today (room is still checked in)
          if (checkInDate <= today && checkOutDate >= today) {
            if (booking.rooms && Array.isArray(booking.rooms)) {
              booking.rooms.forEach(room => {
                // For regular bookings, room.id is the room ID directly
                if (room && room.id) {
                  checkedInRoomIds.add(room.id);
                  console.log(`Added active regular room: ${room.number || room.id} (ID: ${room.id}) from booking ${booking.id}, status: ${booking.status}`);
                } else {
                  console.log(`Regular booking ${booking.id} room missing id:`, room);
                }
              });
            } else {
              console.log(`Regular booking ${booking.id} has active status but no rooms array or rooms is not an array`);
            }
          } else {
            console.log(`Regular booking ${booking.id} is active but dates don't match: check_in=${checkInDate}, check_out=${checkOutDate}, today=${today}`);
          }
        } else {
          console.log(`Regular booking ${booking.id} status '${booking.status}' is not active (normalized: '${normalizeStatus(booking.status)}')`);
        }
      });
      
      // Get room IDs from active package bookings (checked-in or booked, not cancelled)
      // Note: Package bookings have rooms as PackageBookingRoomOut objects with a nested 'room' property
      packageBookings.forEach(booking => {
        if (isActiveBooking(booking.status)) {
          // Parse dates properly
          const checkInDate = new Date(booking.check_in);
          const checkOutDate = new Date(booking.check_out);
          checkInDate.setHours(0, 0, 0, 0);
          checkOutDate.setHours(0, 0, 0, 0);
          
          // Check if booking is active (today is between check-in and check-out)
          // Also allow if check-out is today (room is still checked in)
          if (checkInDate <= today && checkOutDate >= today) {
            if (booking.rooms && Array.isArray(booking.rooms)) {
              booking.rooms.forEach(roomLink => {
                // Package bookings have rooms as PackageBookingRoomOut objects
                // The actual room is nested in roomLink.room
                // Match Services.jsx pattern exactly
                const room = roomLink.room || roomLink;
                // Also check room_id as fallback (direct field in PackageBookingRoomOut)
                const roomId = room?.id || roomLink.room_id;
                if (roomId) {
                  checkedInRoomIds.add(roomId);
                  console.log(`Added active package room: ${room?.number || roomId} (ID: ${roomId}) from booking ${booking.id}, status: ${booking.status}`);
                } else {
                  console.log(`Package booking ${booking.id} room link missing room data:`, roomLink);
                }
              });
            } else {
              console.log(`Package booking ${booking.id} has active status but no rooms array`);
            }
          } else {
            console.log(`Package booking ${booking.id} is active but dates don't match: check_in=${checkInDate}, check_out=${checkOutDate}, today=${today}`);
          }
        } else {
          console.log(`Package booking ${booking.id} status '${booking.status}' is not active (normalized: '${normalizeStatus(booking.status)}')`);
        }
      });
      
      // Also check room status directly as a fallback
      // Include rooms with status: checked-in, booked, occupied (regardless of booking status)
      allRooms.forEach(room => {
        const roomStatusNormalized = normalizeStatus(room.status);
        // Accept: checkedin, booked, occupied, checked-in (any variation)
        if (roomStatusNormalized === 'checkedin' || 
            roomStatusNormalized === 'booked' || 
            roomStatusNormalized === 'occupied' ||
            roomStatusNormalized.includes('checkedin')) {
          checkedInRoomIds.add(room.id);
        }
      });
      
      // Filter rooms to only show checked-in/active rooms
      const checkedInRooms = allRooms.filter(room => checkedInRoomIds.has(room.id));
      
      // Detailed debug logging (matching Services.jsx pattern)
      console.log(`Food Orders - Total checked-in room IDs: ${checkedInRoomIds.size}`, Array.from(checkedInRoomIds));
      console.log(`Food Orders - Filtered checked-in rooms: ${checkedInRooms.length}`, checkedInRooms.map(r => `${r.number || r.id} (status: ${r.status})`));
      console.log('Food Orders - Room Availability Check:', {
        totalRooms: allRooms.length,
        checkedInRoomIds: Array.from(checkedInRoomIds),
        checkedInRoomsCount: checkedInRooms.length,
        regularBookingsCount: regularBookings.length,
        packageBookingsCount: packageBookings.length,
        activeRegularBookings: regularBookings.filter(b => isActiveBooking(b.status)).length,
        activePackageBookings: packageBookings.filter(b => isActiveBooking(b.status)).length,
        today: today.toISOString(),
        allRoomStatuses: allRooms.map(r => ({ id: r.id, number: r.number, status: r.status }))
      });
      
      setRooms(checkedInRooms);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      // Set empty arrays on error to prevent UI breakage
      setOrders([]);
      setRooms([]);
      setEmployees([]);
      setFoodItems([]);
    }
  };

  const loadMoreOrders = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/food-orders/?skip=${(nextPage - 1) * 20}&limit=20`);
      const newOrders = res.data || [];
      setOrders(prev => [...prev, ...newOrders]);
      setPage(nextPage);
      setHasMore(newOrders.length === 20);
    } catch (err) {
      console.error("Failed to load more orders:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { food_item_id: "", quantity: 1 }]);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...selectedItems];
    updated[index][field] = field === "quantity" ? parseInt(value) : value;
    setSelectedItems(updated);
    calculateAmount(updated);
  };

  const calculateAmount = (items) => {
    let total = 0;
    items.forEach((item) => {
      const food = foodItems.find((f) => f.id === parseInt(item.food_item_id));
      if (food) total += food.price * item.quantity;
    });
    setAmount(total);
  };

  const handleSubmit = async () => {
    if (!roomId || !employeeId || selectedItems.length === 0) {
      alert("Please select room, employee, and at least one food item.");
      return;
    }

    const payload = {
      room_id: parseInt(roomId),
      billing_status: "unbilled",
      assigned_employee_id: parseInt(employeeId),
      amount,
      items: selectedItems.map((item) => ({
        food_item_id: parseInt(item.food_item_id),
        quantity: item.quantity,
      })),
    };

    try {
      await api.post("/food-orders/", payload);
      fetchAll();
      setSelectedItems([]);
      setRoomId("");
      setEmployeeId("");
      setAmount(0);
    } catch (err) {
      console.error(err);
      alert("Failed to submit order.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/food-orders/${id}`, { status: newStatus });
      fetchAll();
    } catch (error) {
      console.error("Failed to update status:", error);
      alert("Failed to update order status.");
    }
  };

  // KPI Calculations
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
  const completedOrders = orders.filter((o) => o.status === "completed").length;

  // Chart Data
  const dailyOrdersData = {
    labels: Array.from({ length: 7 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: "Orders",
        data: Array.from({ length: 7 }, () => Math.floor(Math.random() * 10 + 1)),
        backgroundColor: "#4f46e5",
      },
    ],
  };

  const revenueTrendData = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    datasets: [
      {
        label: "Revenue (₹)",
        data: Array.from({ length: 4 }, () => Math.floor(Math.random() * 5000 + 2000)),
        borderColor: "#16a34a",
        backgroundColor: "rgba(22,163,74,0.2)",
        tension: 0.3,
      },
    ],
  };

  const chartOptionsSmall = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { font: { size: 10 } } },
    },
  };

  const filteredOrders = orders.filter((order) => {
    const matchStatus = statusFilter ? order.status === statusFilter : true;
    const matchDate = dateFilter ? order.created_at?.startsWith(dateFilter) : true;
    return matchStatus && matchDate;
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-8">
        <h2 className="text-3xl font-extrabold text-indigo-700 mb-4">🍽 Food Orders Dashboard</h2>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col items-center">
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="text-2xl font-bold text-indigo-700">{totalOrders}</p>
            <div className="w-full h-20 mt-2">
              <Bar data={dailyOrdersData} options={chartOptionsSmall} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col items-center">
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">₹{totalRevenue}</p>
            <div className="w-full h-20 mt-2">
              <Line data={revenueTrendData} options={chartOptionsSmall} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col items-center">
            <p className="text-sm font-medium text-gray-500">Completed Orders</p>
            <p className="text-2xl font-bold text-blue-600">{completedOrders}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5 flex flex-col items-center">
            <p className="text-sm font-medium text-gray-500">Pending Orders</p>
            <p className="text-2xl font-bold text-yellow-600">{totalOrders - completedOrders}</p>
          </div>
        </div>

        {/* Create Order Form */}
        <div className="bg-white shadow-xl rounded-3xl p-8 w-full max-w-4xl mx-auto space-y-6">
          <h3 className="text-xl font-semibold text-gray-700 text-center">Create New Food Order</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
  value={roomId}
  onChange={(e) => setRoomId(e.target.value)}
  className="border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 text-black"
>
  <option value="">Select Room</option>
  {rooms.length === 0 ? (
    <option disabled>No checked-in rooms available</option>
  ) : (
    rooms.map((room) => (
      <option key={room.id} value={room.id}>
        Room {room.number || room.room_number || room.id}
      </option>
    ))
  )}
</select>

            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="border rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 text-black"
            >
              <option value="">Assign Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Food Items Selection */}
          <div className="space-y-4">
            {selectedItems.map((item, index) => (
              <div key={index} className="flex gap-3 items-center">
                <select
                  value={item.food_item_id}
                  onChange={(e) => handleItemChange(index, "food_item_id", e.target.value)}
                  className="border rounded-xl px-4 py-2 flex-1 text-black focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">Select Item</option>
                  {foodItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} (₹{f.price})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                  className="border rounded-xl px-4 py-2 w-20 focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            ))}
            <button
              onClick={handleAddItem}
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-2 shadow transition transform hover:scale-105"
            >
              + Add Item
            </button>
          </div>

          <div className="text-lg font-semibold mt-2">Total: ₹{amount}</div>
                 <button
            onClick={handleSubmit}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl shadow-lg hover:scale-105 transform transition"
          >
            Submit Order
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-4xl mx-auto space-y-4">
          <h3 className="text-xl font-semibold text-gray-700 text-center">Filter Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-400 text-black"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const roomData = rooms.find((r) => r.id === order.room_id);
            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl shadow-xl p-5 hover:shadow-2xl transition transform hover:-translate-y-1"
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-lg">
                    Room: {roomData?.number || roomData?.room_number || order.room_id}
                  </h4>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      statusColors[order.status] || "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status.replace("_", " ")}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Guest: {order.guest_name || "N/A"}
                </div>
                <div className="text-sm mb-2">
                  Employee: {employees.find((e) => e.id === order.assigned_employee_id)?.name || "N/A"}
                </div>
                <div className="font-semibold text-lg mb-2">₹{order.amount}</div>
                <ul className="list-disc ml-5 text-sm mb-2">
                  {order.items.map((item, i) => (
                    <li key={i}>
                      {item.food_item_name} × {item.quantity}
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-500 mb-2">
                  Date: {order.created_at?.slice(0, 10)}
                </div>
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                  className="border px-2 py-1 rounded-xl w-full text-sm text-black focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={loadMoreOrders}
              disabled={isFetchingMore}
              className="bg-indigo-100 text-indigo-700 font-semibold px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:bg-gray-200 disabled:text-gray-500"
            >
              {isFetchingMore ? "Loading..." : "Load More Orders"}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
