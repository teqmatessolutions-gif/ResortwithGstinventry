import React, { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from "recharts";
import { Loader2 } from "lucide-react";
import { getMediaBaseUrl } from "../utils/env";

// Reusable card component for a consistent look
const Card = ({ title, className = "", children }) => (
  <div className={`bg-white rounded-2xl shadow-lg border border-gray-200 p-6 ${className}`}>
    <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
    {children}
  </div>
);

const COLORS = ["#4F46E5", "#6366F1", "#A78BFA", "#F472B6"];

const Services = () => {
  const [services, setServices] = useState([]);
  const [assignedServices, setAssignedServices] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", charges: "", is_visible_to_guest: false });
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagesToRemove, setImagesToRemove] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedInventoryItems, setSelectedInventoryItems] = useState([]); // Array of {inventory_item_id, quantity}
  const [assignForm, setAssignForm] = useState({
    service_id: "",
    employee_id: "",
    room_id: "",
    status: "pending",
  });
  const [selectedServiceDetails, setSelectedServiceDetails] = useState(null); // Store selected service details
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    room: "",
    employee: "",
    status: "",
    from: "",
    to: "",
  });
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [viewingAssignedService, setViewingAssignedService] = useState(null);

  // Fetch all data
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sRes, aRes, rRes, eRes, bRes, pbRes, invRes] = await Promise.all([
        api.get("/services?limit=1000").catch(() => ({ data: [] })),
        api.get("/services/assigned?skip=0&limit=20").catch(() => ({ data: [] })),
        api.get("/rooms?limit=1000").catch(() => ({ data: [] })),
        api.get("/employees").catch(() => ({ data: [] })),
        api.get("/bookings?limit=1000").catch(() => ({ data: { bookings: [] } })),
        api.get("/packages/bookingsall?limit=1000").catch(() => ({ data: [] })),
        api.get("/inventory/items?limit=1000").catch(() => ({ data: [] })),
      ]);
      setServices(sRes?.data || []);
      setAssignedServices(aRes?.data || []);
      setAllRooms(rRes?.data || []);
      setEmployees(eRes?.data || []);
      setInventoryItems(invRes?.data || []);
      
      // Combine regular and package bookings
      const regularBookings = bRes.data?.bookings || [];
      const packageBookings = (pbRes.data || []).map(pb => ({ ...pb, is_package: true }));
      setBookings([...regularBookings, ...packageBookings]);
      
      // Filter rooms to only show checked-in rooms
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      const checkedInRoomIds = new Set();
      
      // Helper function to normalize status (handle all variations)
      const normalizeStatus = (status) => {
        if (!status) return '';
        return status.toLowerCase().replace(/[-_\s]/g, '');
      };
      
      // Helper function to check if status is checked-in
      const isCheckedIn = (status) => {
        const normalized = normalizeStatus(status);
        return normalized === 'checkedin';
      };
      
      // Get room IDs from checked-in regular bookings
      regularBookings.forEach(booking => {
        console.log(`Checking regular booking ${booking.id}, status: ${booking.status}, rooms:`, booking.rooms);
        if (isCheckedIn(booking.status)) {
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
                if (room && room.id) {
                  checkedInRoomIds.add(room.id);
                  console.log(`Added checked-in room: ${room.number} (ID: ${room.id}) from booking ${booking.id}, status: ${booking.status}`);
                } else {
                  console.log(`Booking ${booking.id} room missing id:`, room);
                }
              });
            } else {
              console.log(`Booking ${booking.id} has checked-in status but no rooms array or rooms is not an array`);
            }
          } else {
            console.log(`Booking ${booking.id} is checked-in but dates don't match: check_in=${checkInDate}, check_out=${checkOutDate}, today=${today}`);
          }
        } else {
          console.log(`Regular booking ${booking.id} status '${booking.status}' is not checked-in (normalized: '${normalizeStatus(booking.status)}')`);
        }
      });
      
      // Get room IDs from checked-in package bookings
      // Note: Package bookings have rooms as PackageBookingRoomOut objects with a nested 'room' property
      packageBookings.forEach(booking => {
        console.log(`Checking package booking ${booking.id}, status: ${booking.status}, rooms:`, booking.rooms);
        if (isCheckedIn(booking.status)) {
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
                const room = roomLink.room || roomLink;
                if (room && room.id) {
                  checkedInRoomIds.add(room.id);
                  console.log(`Added checked-in package room: ${room.number} (ID: ${room.id}) from booking ${booking.id}, status: ${booking.status}`);
                } else {
                  console.log(`Package booking ${booking.id} room link missing room data:`, roomLink);
                }
              });
            } else {
              console.log(`Package booking ${booking.id} has checked-in status but no rooms array`);
            }
          } else {
            console.log(`Package booking ${booking.id} is checked-in but dates don't match: check_in=${checkInDate}, check_out=${checkOutDate}, today=${today}`);
          }
        } else {
          console.log(`Package booking ${booking.id} status '${booking.status}' is not checked-in (normalized: '${normalizeStatus(booking.status)}')`);
        }
      });
      
      // Also check room status directly as a fallback (in case booking status is not set correctly)
      rRes.data.forEach(room => {
        const roomStatusNormalized = normalizeStatus(room.status);
        if (roomStatusNormalized === 'checkedin') {
          checkedInRoomIds.add(room.id);
          console.log(`Added checked-in room from room status: ${room.number} (ID: ${room.id}), status: ${room.status}`);
        }
      });
      
      console.log(`Total checked-in room IDs: ${checkedInRoomIds.size}`, Array.from(checkedInRoomIds));
      
      // Filter rooms to only show checked-in rooms
      const checkedInRooms = (rRes?.data || []).filter(room => checkedInRoomIds.has(room.id));
      console.log(`Filtered checked-in rooms: ${checkedInRooms.length}`, checkedInRooms.map(r => `${r.number} (status: ${r.status})`));
      setRooms(checkedInRooms);
    } catch (error) {
      // Set default values on error
      setHasMore(false);
      setPage(1);
      setServices([]);
      setAssignedServices([]);
      setRooms([]);
      setEmployees([]);
      setBookings([]);
      setInventoryItems([]);
      console.error("Error fetching data:", error);
      alert("Failed to load services data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const loadMoreAssigned = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.get(`/services/assigned?skip=${(nextPage - 1) * 20}&limit=20`);
      const newAssigned = res.data || [];
      setAssignedServices(prev => [...prev, ...newAssigned]);
      setPage(nextPage);
      setHasMore(newAssigned.length === 20);
    } catch (err) {
      console.error("Failed to load more assigned services:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedImages(files);
    // Create preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
  };

  // Helper function to get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    const baseUrl = getMediaBaseUrl();
    const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${baseUrl}${path}`;
  };

  // Add inventory item to service
  const handleAddInventoryItem = () => {
    setSelectedInventoryItems([...selectedInventoryItems, { inventory_item_id: "", quantity: 1.0 }]);
  };

  // Remove inventory item from service
  const handleRemoveInventoryItem = (index) => {
    setSelectedInventoryItems(selectedInventoryItems.filter((_, i) => i !== index));
  };

  // Update inventory item selection
  const handleUpdateInventoryItem = (index, field, value) => {
    const updated = [...selectedInventoryItems];
    updated[index] = { ...updated[index], [field]: field === 'quantity' ? parseFloat(value) || 0 : value };
    setSelectedInventoryItems(updated);
  };

  const resetServiceForm = () => {
    setForm({ name: "", description: "", charges: "", is_visible_to_guest: false });
    setSelectedImages([]);
    setImagePreviews([]);
    setExistingImages([]);
    setImagesToRemove([]);
    setSelectedInventoryItems([]);
    setEditingServiceId(null);
  };

  const handleEditService = (service) => {
    setForm({
      name: service.name || "",
      description: service.description || "",
      charges:
        service.charges !== undefined && service.charges !== null
          ? service.charges.toString()
          : "",
      is_visible_to_guest: !!service.is_visible_to_guest,
    });
    setSelectedInventoryItems(
      (service.inventory_items || []).map((item) => ({
        inventory_item_id: item.id,
        quantity: item.quantity || 1,
      }))
    );
    setExistingImages(service.images || []);
    setImagesToRemove([]);
    setSelectedImages([]);
    setImagePreviews([]);
    setEditingServiceId(service.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    resetServiceForm();
  };

  const handleToggleExistingImage = (imageId) => {
    setImagesToRemove((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm("Are you sure you want to delete this service? This action cannot be undone.")) {
      return;
    }
    try {
      await api.delete(`/services/${serviceId}`);
      if (editingServiceId === serviceId) {
        resetServiceForm();
      }
      fetchAll();
    } catch (err) {
      console.error("Failed to delete service", err);
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error";
      alert(`Failed to delete service: ${errorMsg}`);
    }
  };

  // Create or update service
  const handleSaveService = async () => {
    if (!form.name || !form.description || !form.charges) {
      alert("All fields are required");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('charges', parseFloat(form.charges));
      formData.append('is_visible_to_guest', form.is_visible_to_guest ? 'true' : 'false');
      
      // Append images
      selectedImages.forEach((image) => {
        formData.append('images', image);
      });

      // Append inventory items as JSON (filter out empty selections)
      const validInventoryItems = selectedInventoryItems.filter(
        item => item.inventory_item_id && item.quantity > 0
      );
      if (editingServiceId || validInventoryItems.length > 0) {
        formData.append('inventory_items', JSON.stringify(validInventoryItems));
      }

      if (editingServiceId && imagesToRemove.length > 0) {
        formData.append('remove_image_ids', JSON.stringify(imagesToRemove));
      }

      if (editingServiceId) {
        await api.put(`/services/${editingServiceId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post("/services", formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      resetServiceForm();
      fetchAll();
    } catch (err) {
      console.error("Failed to save service", err);
      const errorMsg = err.response?.data?.detail || err.message || "Unknown error";
      console.error("Error details:", err.response?.data);
      alert(`Failed to save service: ${errorMsg}`);
    }
  };

  // Fetch service details when service is selected
  const handleServiceSelect = async (serviceId) => {
    if (!serviceId) {
      setSelectedServiceDetails(null);
      setAssignForm({ ...assignForm, service_id: serviceId });
      return;
    }
    
    try {
      // Always fetch fresh service data from API to ensure inventory items are loaded
      // First try to find in cached list for quick display
      const cachedService = services.find(s => s.id === parseInt(serviceId));
      if (cachedService && cachedService.inventory_items && cachedService.inventory_items.length > 0) {
        // Use cached if it has inventory items
        setSelectedServiceDetails(cachedService);
      } else {
        // Fetch all services and find the one we need (to get fresh inventory data)
        const response = await api.get(`/services?limit=1000`);
        const allServices = response.data || [];
        const foundService = allServices.find(s => s.id === parseInt(serviceId));
        if (foundService) {
          setSelectedServiceDetails(foundService);
          // Also update the cached services list with fresh data
          setServices(prevServices => {
            const updated = [...prevServices];
            const index = updated.findIndex(s => s.id === parseInt(serviceId));
            if (index >= 0) {
              updated[index] = foundService;
            }
            return updated;
          });
        } else if (cachedService) {
          // Fallback to cached if API doesn't return it
          setSelectedServiceDetails(cachedService);
        }
      }
      setAssignForm({ ...assignForm, service_id: serviceId });
    } catch (err) {
      console.error("Failed to fetch service details", err);
      // Fallback to cached service if API fails
      const cachedService = services.find(s => s.id === parseInt(serviceId));
      if (cachedService) {
        setSelectedServiceDetails(cachedService);
      } else {
        setSelectedServiceDetails(null);
      }
    }
  };

  // Assign service
  const handleAssign = async () => {
    if (!assignForm.service_id || !assignForm.employee_id || !assignForm.room_id) {
      alert("Please select service, employee, and room");
      return;
    }
    try {
      const response = await api.post("/services/assign", {
        service_id: parseInt(assignForm.service_id),
        employee_id: parseInt(assignForm.employee_id),
        room_id: parseInt(assignForm.room_id),
        // Note: status is set by default in the backend model, no need to send it
      });
      alert("Service assigned successfully!");
      setAssignForm({ service_id: "", employee_id: "", room_id: "", status: "pending" });
      setSelectedServiceDetails(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to assign service", err);
      console.error("Error details:", {
        message: err.message,
        response: err.response,
        config: err.config,
        isNetworkError: err.isNetworkError,
        isTimeout: err.isTimeout
      });
      
      let errorMsg = "Failed to assign service. ";
      if (err.isNetworkError) {
        errorMsg += "Network error - please check if the backend server is running on port 8011.";
      } else if (err.isTimeout) {
        errorMsg += "Request timed out - the server is taking too long to respond.";
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg += err.message;
      }
      
      alert(`Error: ${errorMsg}`);
    }
  };

  // Toggle service visibility to guests
  const handleToggleVisibility = async (serviceId, currentVisibility) => {
    try {
      await api.patch(`/services/${serviceId}/visibility`, {
        is_visible_to_guest: !currentVisibility
      });
      fetchAll(); // Refresh the list
    } catch (err) {
      console.error("Failed to toggle service visibility", err);
      alert("Failed to update service visibility. Please try again.");
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/services/assigned/${id}`, { status: newStatus });
      fetchAll();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleViewAssignedService = async (assignedService) => {
    try {
      console.log("[DEBUG] Viewing assigned service:", assignedService);
      console.log("[DEBUG] Service data:", assignedService.service);
      console.log("[DEBUG] Inventory items in assigned service:", assignedService.service?.inventory_items);
      
      // Always fetch fresh service details to ensure we have inventory items
      const serviceResponse = await api.get(`/services?limit=1000`);
      const allServices = serviceResponse.data || [];
      const service = allServices.find(s => s.id === assignedService.service_id);
      
      console.log("[DEBUG] Found service from API:", service);
      console.log("[DEBUG] Service inventory items from API:", service?.inventory_items);
      
      if (service) {
        setViewingAssignedService({
          ...assignedService,
          service: service // Include full service details with inventory_items
        });
      } else {
        // Fallback to assigned service data if service not found
        console.warn("[WARNING] Service not found, using assigned service data");
        setViewingAssignedService(assignedService);
      }
    } catch (error) {
      console.error("Failed to fetch service details:", error);
      // Still show the assigned service even if we can't fetch full details
      setViewingAssignedService(assignedService);
    }
  };

  const handleDeleteAssignedService = async (assignedId) => {
    if (!window.confirm("Remove this assigned service? This cannot be undone.")) {
      return;
    }
    try {
      await api.delete(`/services/assigned/${assignedId}`);
      fetchAll();
    } catch (error) {
      console.error("Failed to delete assigned service:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      alert(`Failed to delete assigned service: ${msg}`);
    }
  };

  const handleClearAllServices = async () => {
    const confirmMessage = `⚠️ WARNING: This will delete ALL services and assigned services!\n\n` +
      `This includes:\n` +
      `- All services\n` +
      `- All assigned services\n` +
      `- All service images\n` +
      `- All service inventory item links\n\n` +
      `This action CANNOT be undone!\n\n` +
      `Type "DELETE ALL" to confirm:`;
    
    const userInput = window.prompt(confirmMessage);
    if (userInput !== "DELETE ALL") {
      alert("Deletion cancelled.");
      return;
    }

    try {
      const response = await api.delete("/services/clear-all");
      alert(`✅ Success! Cleared:\n- ${response.data.deleted.assigned_services} assigned services\n- ${response.data.deleted.services} services\n- ${response.data.deleted.service_images} service images\n- ${response.data.deleted.service_inventory_items} inventory item links`);
      fetchAll(); // Refresh the page
    } catch (error) {
      console.error("Failed to clear all services:", error);
      const msg = error.response?.data?.detail || error.message || "Unknown error";
      alert(`Failed to clear all services: ${msg}`);
    }
  };

  const filteredAssigned = assignedServices.filter((s) => {
    const assignedDate = new Date(s.assigned_at);
    const fromDate = filters.from ? new Date(filters.from) : null;
    const toDate = filters.to ? new Date(filters.to) : null;
    return (
      (!filters.room || s.room_id === parseInt(filters.room)) &&
      (!filters.employee || s.employee_id === parseInt(filters.employee)) &&
      (!filters.status || s.status === filters.status) &&
      (!fromDate || assignedDate >= fromDate) &&
      (!toDate || assignedDate <= toDate)
    );
  });

  // KPI Data
  const totalServices = services.length;
  const totalAssigned = assignedServices.length;
  const completedCount = assignedServices.filter(s => s.status === "completed").length;
  const pendingCount = assignedServices.filter(s => s.status === "pending").length;

  // Pie chart for status
  const pieData = [
    { name: "Pending", value: pendingCount },
    { name: "Completed", value: completedCount },
    { name: "In Progress", value: totalAssigned - pendingCount - completedCount },
  ];

  // Bar chart for service assignments
  const barData = services.map(s => ({
    name: s.name,
    assigned: assignedServices.filter(a => a.service_id === s.id).length,
  }));

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-3xl font-bold text-gray-800">Service Management Dashboard</h2>
          <button
            onClick={handleClearAllServices}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium shadow-md transition-colors"
            title="Clear all services and assigned services"
          >
            🗑️ Clear All Services
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-r from-indigo-500 to-indigo-700 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <p className="text-sm opacity-80">Total Services</p>
            <p className="text-3xl font-bold">{totalServices}</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-700 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <p className="text-sm opacity-80">Total Assigned</p>
            <p className="text-3xl font-bold">{totalAssigned}</p>
          </div>
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <p className="text-sm opacity-80">Pending</p>
            <p className="text-3xl font-bold">{pendingCount}</p>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-700 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center">
            <p className="text-sm opacity-80">Completed</p>
            <p className="text-3xl font-bold">{completedCount}</p>
          </div>
        </div>

        {/* Create & Assign Forms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Service */}
          <Card title="Create New Service">
            <div className="space-y-3">
              {editingServiceId && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col gap-2">
                  <div className="text-sm text-yellow-800 font-semibold">
                    Editing service ID #{editingServiceId}. Update the details below and click "Update Service" to save changes.
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="self-start text-sm text-blue-700 hover:text-blue-900 underline"
                  >
                    Cancel editing
                  </button>
                </div>
              )}
              <input
                type="text"
                placeholder="Service Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="text"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-400"
              />
              <input
                type="number"
                placeholder="Charges"
                value={form.charges}
                onChange={(e) => setForm({ ...form, charges: e.target.value })}
                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-400"
              />
              {/* Guest Visibility Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_visible_to_guest"
                  checked={form.is_visible_to_guest}
                  onChange={(e) => setForm({ ...form, is_visible_to_guest: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_visible_to_guest" className="text-sm font-medium text-gray-700">
                  Visible to Guests/Users
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-indigo-400"
                />
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {imagePreviews.map((preview, idx) => (
                      <img key={idx} src={preview} alt={`Preview ${idx + 1}`} className="w-full h-20 object-cover rounded border" />
                    ))}
                  </div>
                )}
                {editingServiceId && existingImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Existing Images</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {existingImages.map((img) => {
                        const marked = imagesToRemove.includes(img.id);
                        return (
                          <div
                            key={img.id}
                            className={`border rounded-lg p-2 text-center ${marked ? "border-red-400 bg-red-50 opacity-70" : "border-gray-200"}`}
                          >
                            <img
                              src={getImageUrl(img.image_url)}
                              alt="Service"
                              className="w-full h-20 object-cover rounded mb-2"
                            />
                            <button
                              type="button"
                              onClick={() => handleToggleExistingImage(img.id)}
                              className={`w-full text-xs font-semibold px-2 py-1 rounded ${
                                marked ? "bg-gray-200 text-gray-700" : "bg-red-500 text-white"
                              }`}
                            >
                              {marked ? "Keep Image" : "Remove Image"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Inventory Items Section */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Inventory Items (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleAddInventoryItem}
                  className="mb-2 text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded"
                >
                  + Add Inventory Item
                </button>
                {selectedInventoryItems.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-end">
                    <select
                      value={item.inventory_item_id}
                      onChange={(e) => handleUpdateInventoryItem(index, 'inventory_item_id', e.target.value)}
                      className="flex-1 border p-2 rounded-lg text-sm"
                    >
                      <option value="">Select Item</option>
                      {inventoryItems.map((invItem) => (
                        <option key={invItem.id} value={invItem.id}>
                          {invItem.name} {invItem.item_code ? `(${invItem.item_code})` : ''} - {invItem.unit}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleUpdateInventoryItem(index, 'quantity', e.target.value)}
                      placeholder="Qty"
                      min="0.01"
                      step="0.01"
                      className="w-24 border p-2 rounded-lg text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveInventoryItem(index)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveService}
                className="w-full mt-3 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg shadow-lg font-semibold"
              >
                {editingServiceId ? "Update Service" : "Create Service"}
              </button>
              {editingServiceId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 p-3 rounded-lg font-semibold"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </Card>

          {/* Assign Service */}
          <Card title="Assign Service">
            <div className="space-y-3">
              <select
                value={assignForm.service_id}
                onChange={(e) => handleServiceSelect(e.target.value)}
                className="w-full border p-3 rounded-lg"
              >
                <option value="">Select Service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Service Details Display */}
              {selectedServiceDetails && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-semibold text-lg text-gray-800 mb-3">Service Details</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div>
                      <span className="font-medium text-gray-700">Name:</span>
                      <span className="ml-2 text-gray-900">{selectedServiceDetails.name}</span>
                    </div>
                    {selectedServiceDetails.description && (
                      <div>
                        <span className="font-medium text-gray-700">Description:</span>
                        <p className="ml-2 text-gray-900 mt-1">{selectedServiceDetails.description}</p>
                      </div>
                    )}
                    <div>
                      <span className="font-medium text-gray-700">Charges:</span>
                      <span className="ml-2 text-gray-900 font-semibold">₹{selectedServiceDetails.charges}</span>
                    </div>
                    {selectedServiceDetails.images && selectedServiceDetails.images.length > 0 && (
                      <div className="mt-2">
                        <span className="font-medium text-gray-700">Images:</span>
                        <div className="flex gap-2 mt-2">
                          {selectedServiceDetails.images.slice(0, 3).map((img, idx) => (
                            <img
                              key={idx}
                              src={getImageUrl(img.image_url)}
                              alt={`${selectedServiceDetails.name} ${idx + 1}`}
                              className="w-20 h-20 object-cover rounded border"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inventory Items Needed */}
                  {selectedServiceDetails.inventory_items && selectedServiceDetails.inventory_items.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-300">
                      <h4 className="font-semibold text-md text-gray-800 mb-2">Inventory Items Needed:</h4>
                      <div className="space-y-2">
                        {selectedServiceDetails.inventory_items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-blue-200">
                            <div className="flex-1">
                              <span className="font-medium text-gray-800">{item.name}</span>
                              {item.item_code && (
                                <span className="ml-2 text-sm text-gray-600">({item.item_code})</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-gray-600">
                                {item.quantity} {item.unit}
                              </span>
                              {item.unit_price > 0 && (
                                <span className="ml-2 text-sm text-gray-500">
                                  @ ₹{item.unit_price}/{item.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {(!selectedServiceDetails.inventory_items || selectedServiceDetails.inventory_items.length === 0) && (
                    <div className="mt-4 pt-4 border-t border-blue-300">
                      <p className="text-sm text-gray-600 italic">No inventory items required for this service.</p>
                    </div>
                  )}
                </div>
              )}

              <select
                value={assignForm.employee_id}
                onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                className="w-full border p-3 rounded-lg"
              >
                <option value="">Select Employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <select
                value={assignForm.room_id}
                onChange={(e) => setAssignForm({ ...assignForm, room_id: e.target.value })}
                className="w-full border p-3 rounded-lg"
              >
                <option value="">Select Room</option>
                {rooms.length === 0 ? (
                  <option value="" disabled>No checked-in rooms available</option>
                ) : (
                  rooms.map((r) => (
                    <option key={r.id} value={r.id}>Room {r.number}</option>
                  ))
                )}
              </select>
              <select
                value={assignForm.status}
                onChange={(e) => setAssignForm({ ...assignForm, status: e.target.value })}
                className="w-full border p-3 rounded-lg"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <button
                onClick={handleAssign}
                className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg shadow-lg font-semibold"
              >
                Assign Service
              </button>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Service Status Distribution">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Service Assignments">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="assigned" fill="#4F46E5" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* View All Services Table */}
        <Card title="All Services">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={48} className="animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">Image</th>
                    <th className="py-3 px-4 text-left">Service Name</th>
                    <th className="py-3 px-4 text-left">Description</th>
                    <th className="py-3 px-4 text-right">Charges ($)</th>
                    <th className="py-3 px-4 text-center">Visible to Guests</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, idx) => (
                    <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}>
                      <td className="py-3 px-4">
                        {s.images && s.images.length > 0 ? (
                          <img src={getImageUrl(s.images[0].image_url)} alt={s.name} className="w-16 h-16 object-cover rounded border" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded border flex items-center justify-center text-xs text-gray-400">No Image</div>
                        )}
                      </td>
                      <td className="py-3 px-4">{s.name}</td>
                      <td className="py-3 px-4">{s.description}</td>
                      <td className="py-3 px-4 text-right">{s.charges}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          s.is_visible_to_guest 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {s.is_visible_to_guest ? 'Visible' : 'Hidden'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            onClick={() => handleToggleVisibility(s.id, s.is_visible_to_guest)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              s.is_visible_to_guest
                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                            title={s.is_visible_to_guest ? 'Hide from guests' : 'Show to guests'}
                          >
                            {s.is_visible_to_guest ? 'Hide' : 'Show'}
                          </button>
                          <button
                            onClick={() => handleEditService(s)}
                            className="px-3 py-1 rounded text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteService(s.id)}
                            className="px-3 py-1 rounded text-sm font-medium bg-red-500 hover:bg-red-600 text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="text-center mt-4">
                  <button
                    onClick={loadMoreAssigned}
                    disabled={isFetchingMore}
                    className="bg-indigo-100 text-indigo-700 font-semibold px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {isFetchingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Filters & Assigned Services Table */}
        <Card title="Assigned Services">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <select value={filters.room} onChange={(e) => setFilters({ ...filters, room: e.target.value })} className="border p-2 rounded-lg">
              <option value="">All Rooms</option>
              {assignedServices.map((s) => {
                const room = s.room;
                return room ? <option key={room.id} value={room.id}>Room {room.number}</option> : null;
              }).filter(Boolean)}
            </select>
            <select value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} className="border p-2 rounded-lg">
              <option value="">All Employees</option>
              {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
            </select>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="border p-2 rounded-lg">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="border p-2 rounded-lg"/>
            <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="border p-2 rounded-lg"/>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 size={48} className="animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg">
                <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-left">Service</th>
                    <th className="py-3 px-4 text-left">Employee</th>
                    <th className="py-3 px-4 text-left">Room</th>
                    <th className="py-3 px-4 text-left">Status</th>
                    <th className="py-3 px-4 text-left">Assigned At</th>
                    <th className="py-3 px-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssigned.map((s, idx) => (
                    <tr key={s.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}>
                      <td className="p-3 border-t border-gray-200">{s.service?.name}</td>
                      <td className="p-3 border-t border-gray-200">{s.employee?.name}</td>
                      <td className="p-3 border-t border-gray-200">Room {s.room?.number}</td>
                      <td className="p-3 border-t border-gray-200">
                        <select value={s.status} onChange={(e) => handleStatusChange(s.id, e.target.value)} className="border p-2 rounded-lg bg-white">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="p-3 border-t border-gray-200">{s.assigned_at && new Date(s.assigned_at).toLocaleString()}</td>
                      <td className="p-3 border-t border-gray-200">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewAssignedService(s)}
                            className="px-3 py-1 rounded text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDeleteAssignedService(s.id)}
                            className="px-3 py-1 rounded text-sm font-medium bg-red-500 hover:bg-red-600 text-white"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* View Assigned Service Modal */}
      {viewingAssignedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Assigned Service Details</h2>
                <button
                  onClick={() => setViewingAssignedService(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>

              <div className="space-y-6">
                {/* Service Information */}
                {viewingAssignedService.service && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-lg text-gray-800 mb-3">Service Information</h3>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-gray-700">Name:</span>
                        <span className="ml-2 text-gray-900">{viewingAssignedService.service.name}</span>
                      </div>
                      {viewingAssignedService.service.description && (
                        <div>
                          <span className="font-medium text-gray-700">Description:</span>
                          <p className="ml-2 text-gray-900 mt-1">{viewingAssignedService.service.description}</p>
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-gray-700">Charges:</span>
                        <span className="ml-2 text-gray-900 font-semibold">₹{viewingAssignedService.service.charges}</span>
                      </div>
                      {viewingAssignedService.service.images && viewingAssignedService.service.images.length > 0 && (
                        <div className="mt-2">
                          <span className="font-medium text-gray-700">Images:</span>
                          <div className="flex gap-2 mt-2">
                            {viewingAssignedService.service.images.slice(0, 3).map((img, idx) => (
                              <img
                                key={idx}
                                src={getImageUrl(img.image_url)}
                                alt={`${viewingAssignedService.service.name} ${idx + 1}`}
                                className="w-20 h-20 object-cover rounded border"
                                onError={(e) => {
                                  e.target.src = '/placeholder-image.png';
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Assignment Information */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg text-gray-800 mb-3">Assignment Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium text-gray-700">Employee:</span>
                      <span className="ml-2 text-gray-900">{viewingAssignedService.employee?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Room:</span>
                      <span className="ml-2 text-gray-900">Room {viewingAssignedService.room?.number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className="ml-2 text-gray-900 capitalize">{viewingAssignedService.status || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Assigned At:</span>
                      <span className="ml-2 text-gray-900">
                        {viewingAssignedService.assigned_at ? new Date(viewingAssignedService.assigned_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Inventory Items Needed */}
                {(() => {
                  const inventoryItems = viewingAssignedService.service?.inventory_items;
                  console.log("[DEBUG Modal] Inventory items check:", {
                    hasService: !!viewingAssignedService.service,
                    hasInventoryItems: !!inventoryItems,
                    inventoryItemsType: typeof inventoryItems,
                    inventoryItemsIsArray: Array.isArray(inventoryItems),
                    inventoryItemsLength: inventoryItems?.length,
                    inventoryItemsValue: inventoryItems
                  });
                  
                  if (inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
                    return (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-lg text-gray-800 mb-3">Inventory Items Needed</h3>
                        <div className="space-y-2">
                          {inventoryItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-green-200">
                              <div className="flex-1">
                                <span className="font-medium text-gray-800">{item.name}</span>
                                {item.item_code && (
                                  <span className="ml-2 text-sm text-gray-600">({item.item_code})</span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-sm text-gray-600">
                                  {item.quantity} {item.unit}
                                </span>
                                {item.unit_price > 0 && (
                                  <span className="ml-2 text-sm text-gray-500">
                                    @ ₹{item.unit_price}/{item.unit}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-gray-600 italic">
                          No inventory items required for this service.
                          {inventoryItems && Array.isArray(inventoryItems) && inventoryItems.length === 0 && (
                            <span className="block mt-1 text-xs">(Service has empty inventory_items array)</span>
                          )}
                          {!inventoryItems && (
                            <span className="block mt-1 text-xs">(Service has no inventory_items property)</span>
                          )}
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setViewingAssignedService(null)}
                  className="px-6 py-2 rounded-lg text-sm font-medium bg-gray-500 hover:bg-gray-600 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Services;
