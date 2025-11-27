import React, { useEffect, useState, useMemo } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import DashboardLayout from "../layout/DashboardLayout";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { motion } from "framer-motion";
import { getMediaBaseUrl } from "../utils/env";

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

// Helper function to construct image URLs
const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/400x300/e2e8f0/a0aec0?text=No+Image';
  if (imagePath.startsWith('http')) return imagePath;
  const baseUrl = getMediaBaseUrl();
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${baseUrl}${path}`;
};

// KPI Card
const KpiCard = ({ title, value, icon, color }) => (
  <div className={`p-6 rounded-2xl text-white shadow-lg flex items-center justify-between transition-transform duration-300 transform hover:scale-105 ${color}`}>
    <div className="flex-1">
      <h4 className="text-lg font-medium">{title}</h4>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
    <div className="text-4xl opacity-80">{icon}</div>
  </div>
);

// Card Wrapper
const Card = ({ children, title, className = "" }) => (
  <div className={`bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-shadow duration-300 hover:shadow-xl ${className}`}>
    {title && <h3 className="text-2xl font-bold text-gray-800 mb-6">{title}</h3>}
    {children}
  </div>
);

// Check-in Modal Component
const CheckInModal = ({ booking, onSave, onClose, isSubmitting }) => {
  const [idCardImage, setIdCardImage] = useState(null);
  const [guestPhoto, setGuestPhoto] = useState(null);
  const [idCardPreview, setIdCardPreview] = useState(null);
  const [guestPhotoPreview, setGuestPhotoPreview] = useState(null);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    if (type === 'id') {
      setIdCardImage(file);
      setIdCardPreview(previewUrl);
    } else {
      setGuestPhoto(file);
      setGuestPhotoPreview(previewUrl);
    }
  };

  const handleSave = () => {
    if (!idCardImage || !guestPhoto) {
      toast.error("Please upload both ID card and guest photo.");
      return;
    }
    onSave(booking.id, { id_card_image: idCardImage, guest_photo: guestPhoto });
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-2xl">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Check-in Guest: {booking.guest_name}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col items-center"><label className="font-medium text-gray-700 mb-2">ID Card Image</label><input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'id')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" required />{idCardPreview && <img src={idCardPreview} alt="ID Preview" className="mt-4 w-full h-40 object-contain rounded-lg border" />}</div>
          <div className="flex flex-col items-center"><label className="font-medium text-gray-700 mb-2">Guest Photo</label><input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'guest')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" required />{guestPhotoPreview && <img src={guestPhotoPreview} alt="Guest Preview" className="mt-4 w-full h-40 object-contain rounded-lg border" />}</div>
        </div>
        <div className="flex gap-4 mt-6"><button onClick={onClose} className="w-full bg-gray-200 text-gray-800 font-semibold py-2 rounded-md hover:bg-gray-300 transition-colors">Cancel</button><button onClick={handleSave} disabled={isSubmitting || !idCardImage || !guestPhoto} className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:bg-gray-400">{isSubmitting ? "Checking in..." : "Confirm Check-in"}</button></div>
      </motion.div>
    </div>
  );
};

// --- Chart Configurations for a Professional Look ---

const CHART_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

const commonChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: {
          family: 'Inter, sans-serif',
          size: 12,
        },
        color: '#4b5563', // gray-600
      },
    },
    tooltip: {
      enabled: true,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleFont: { size: 14, weight: 'bold' },
      bodyFont: { size: 12 },
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#6b7280' }, // gray-500
      border: { color: '#e5e7eb' }, // gray-200
    },
    y: {
      grid: { color: '#f3f4f6' }, // gray-100
      ticks: { color: '#6b7280' }, // gray-500
      border: { display: false },
    },
  },
};

const Packages = () => {
  const [packages, setPackages] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [allRooms, setAllRooms] = useState([]); // Store all rooms for filtering
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBooking, setEditingBooking] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null); // Package being edited
  const [packageFilter, setPackageFilter] = useState("");
  const [bookingToCheckIn, setBookingToCheckIn] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingFilter, setBookingFilter] = useState({ guestName: "", status: "all", checkIn: "", checkOut: "" });
  const [createForm, setCreateForm] = useState({ 
    title: "", 
    description: "", 
    price: "", 
    booking_type: "room_type",  // "whole_property" or "room_type"
    selected_room_types: [],  // Array of selected room types
    images: [] 
  });
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: "",
    booking_type: "room_type",
    selected_room_types: [],
    images: []
  });
  const [editImagePreviews, setEditImagePreviews] = useState([]);
  const [editSelectedFiles, setEditSelectedFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]); // Store the actual File objects
  const [selectedPackageImages, setSelectedPackageImages] = useState(null); // For image gallery modal
  const [bookingForm, setBookingForm] = useState({
    package_id: "",
    guest_name: "",
    guest_email: "",
    guest_mobile: "",
    check_in: "",
    check_out: "",
    adults: 2,
    children: 0,
    room_ids: []
  });

  const fetchData = async () => {
    try {
      const [packageRes, roomRes, bookingRes] = await Promise.all([
        api.get("/packages/"),
        api.get("/rooms/"),
        api.get("/packages/bookingsall")
      ]);
      const allRoomsData = roomRes.data || [];
      setPackages(packageRes.data || []);
      setAllRooms(allRoomsData);
      setRooms(allRoomsData.filter(r => r.status === "Available")); // Initial available rooms
      setBookings(bookingRes.data || []);
    } catch (err) {
      toast.error("Failed to load data.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Filter rooms based on selected dates and package booking type
  useEffect(() => {
    if (bookingForm.check_in && bookingForm.check_out && allRooms.length > 0) {
      const selectedPackage = packages.find(p => p.id === parseInt(bookingForm.package_id));
      
      let availableRooms = allRooms.filter(room => {
        // Check if room has any conflicting bookings
        // Only consider bookings with status "booked" or "checked-in" as conflicts
        const hasConflict = bookings.some(booking => {
          const normalizedStatus = booking.status?.toLowerCase().replace(/_/g, '-');
          // Only check for "booked" or "checked-in" status - all other statuses are available
          if (normalizedStatus !== "booked" && normalizedStatus !== "checked-in") return false;
          
          const bookingCheckIn = new Date(booking.check_in);
          const bookingCheckOut = new Date(booking.check_out);
          const requestedCheckIn = new Date(bookingForm.check_in);
          const requestedCheckOut = new Date(bookingForm.check_out);
          
          // Check if room is part of this booking
          const isRoomInBooking = booking.rooms && booking.rooms.some(r => r.room.id === room.id);
          if (!isRoomInBooking) return false;
          
          // Check for date overlap
          return (requestedCheckIn < bookingCheckOut && requestedCheckOut > bookingCheckIn);
        });
        
        // If there are no conflicting bookings for the selected dates, room is available
        // Don't filter by room.status - availability is determined by booking conflicts, not status field
        return !hasConflict;
      });
      
      // If package is selected and has room_types, filter by room types (case-insensitive)
      if (selectedPackage && selectedPackage.booking_type === 'room_type' && selectedPackage.room_types) {
        const allowedRoomTypes = selectedPackage.room_types.split(',').map(t => t.trim().toLowerCase());
        availableRooms = availableRooms.filter(room => {
          const roomType = room.type ? room.type.trim().toLowerCase() : '';
          return allowedRoomTypes.includes(roomType);
        });
      }
      
      setRooms(availableRooms);
      
      // If whole_property, automatically select all available rooms
      if (selectedPackage && selectedPackage.booking_type === 'whole_property' && availableRooms.length > 0) {
        setBookingForm(prev => ({
          ...prev,
          room_ids: availableRooms.map(r => r.id)
        }));
      } else if (selectedPackage && selectedPackage.booking_type === 'room_type') {
        // For room_type, clear selection if package changed or dates changed
        // User will manually select rooms
      }
    } else if (!bookingForm.check_in || !bookingForm.check_out) {
      // If no dates selected, show all available rooms
      setRooms(allRooms.filter(r => r.status === "Available"));
    }
  }, [bookingForm.check_in, bookingForm.check_out, bookingForm.package_id, allRooms, bookings, packages]);

  // Filter only available rooms
  const availableRooms = rooms.filter(r => r.status == "Available");

  // Get unique room types from all rooms
  const uniqueRoomTypes = useMemo(() => {
    const types = new Set();
    allRooms.forEach(room => {
      if (room.type) {
        types.add(room.type);
      }
    });
    return Array.from(types).sort();
  }, [allRooms]);

  // Create Package Form handlers
  const handleCreateChange = e => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      // Handle room type checkboxes
      if (name === 'room_type') {
        setCreateForm(prev => {
          const selected = prev.selected_room_types || [];
          if (checked) {
            return { ...prev, selected_room_types: [...selected, value] };
          } else {
            return { ...prev, selected_room_types: selected.filter(t => t !== value) };
          }
        });
      }
    } else {
      setCreateForm(prev => ({ ...prev, [name]: value }));
      // If booking_type changes to whole_property, clear selected room types
      if (name === 'booking_type' && value === 'whole_property') {
        setCreateForm(prev => ({ ...prev, selected_room_types: [] }));
      }
    }
  };
  const handleCreateImageChange = e => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };
  const handleRemoveImage = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };
  const handleCreateSubmit = async e => {
    e.preventDefault();
    
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please log in to create a package");
      return;
    }
    
    try {
      const data = new FormData();
      data.append("title", createForm.title);
      data.append("description", createForm.description);
      data.append("price", createForm.price);
      data.append("booking_type", createForm.booking_type || "room_type");
      
      // If booking_type is room_type, append selected room types as comma-separated string
      if (createForm.booking_type === "room_type") {
        if (!createForm.selected_room_types || createForm.selected_room_types.length === 0) {
          toast.error("Please select at least one room type");
          return;
        }
        data.append("room_types", createForm.selected_room_types.join(","));
      }
      
      selectedFiles.forEach(img => data.append("images", img));
      // Don't set Content-Type manually - axios will set it automatically with the correct boundary
      // This ensures the Authorization header from the interceptor is preserved
      await api.post("/packages/", data);
      toast.success("Package created successfully!");
      setCreateForm({ 
        title: "", 
        description: "", 
        price: "", 
        booking_type: "room_type",
        selected_room_types: [],
        images: [] 
      });
      setImagePreviews([]);
      setSelectedFiles([]);
      fetchData();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to create package';
      toast.error(message);
    }
  };
  const handleEditPackage = (pkg) => {
    setEditingPackage(pkg);
    setEditForm({
      title: pkg.title || "",
      description: pkg.description || "",
      price: pkg.price || "",
      booking_type: pkg.booking_type || "room_type",
      selected_room_types: pkg.room_types ? pkg.room_types.split(',').map(t => t.trim()) : [],
      images: []
    });
    setEditImagePreviews(pkg.images ? pkg.images.map(img => getImageUrl(img.image_url)) : []);
    setEditSelectedFiles([]);
  };

  const handleEditChange = e => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'room_type') {
        setEditForm(prev => {
          const selected = prev.selected_room_types || [];
          if (checked) {
            return { ...prev, selected_room_types: [...selected, value] };
          } else {
            return { ...prev, selected_room_types: selected.filter(t => t !== value) };
          }
        });
      }
    } else {
      setEditForm(prev => ({ ...prev, [name]: value }));
      if (name === 'booking_type' && value === 'whole_property') {
        setEditForm(prev => ({ ...prev, selected_room_types: [] }));
      }
    }
  };

  const handleEditImageChange = e => {
    const files = Array.from(e.target.files);
    setEditSelectedFiles(prev => [...prev, ...files]);
    setEditImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const handleRemoveEditImage = (index) => {
    setEditSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setEditImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditSubmit = async e => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append("title", editForm.title);
      data.append("description", editForm.description);
      data.append("price", editForm.price);
      data.append("booking_type", editForm.booking_type || "room_type");
      
      if (editForm.booking_type === "room_type") {
        if (!editForm.selected_room_types || editForm.selected_room_types.length === 0) {
          toast.error("Please select at least one room type");
          return;
        }
        data.append("room_types", editForm.selected_room_types.join(","));
      }
      
      editSelectedFiles.forEach(img => data.append("images", img));
      
      await api.put(`/packages/${editingPackage.id}`, data, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Package updated successfully!");
      setEditingPackage(null);
      setEditForm({ 
        title: "", 
        description: "", 
        price: "", 
        booking_type: "room_type",
        selected_room_types: [],
        images: [] 
      });
      setEditImagePreviews([]);
      setEditSelectedFiles([]);
      fetchData();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to update package';
      toast.error(message);
    }
  };

  const handleDeletePackage = async id => {
    if (window.confirm("Are you sure you want to delete this package?")) {
      try {
        await api.delete(`/packages/${id}`);
        toast.success("Package deleted successfully!");
        fetchData();
      } catch (err) {
        console.error(err);
        const errorMsg = err.response?.data?.detail;
        const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to delete package';
        toast.error(message);
      }
    }
  };

  // Booking handlers
  const handleBookingChange = e => {
    const { name, value } = e.target;
    setBookingForm(prev => {
      const updated = { ...prev, [name]: value };
      
      // When package is selected, check its booking_type
      if (name === 'package_id' && value) {
        const selectedPackage = packages.find(p => p.id === parseInt(value));
        if (selectedPackage) {
          // If whole_property, automatically select all available rooms
          if (selectedPackage.booking_type === 'whole_property') {
            // Will be handled in useEffect when dates are selected
            updated.room_ids = [];
          } else if (selectedPackage.booking_type === 'room_type' && selectedPackage.room_types) {
            // Clear room selection when switching packages
            updated.room_ids = [];
          }
        }
      }
      
      return updated;
    });
  };
  
  const handleRoomSelect = roomId => {
    setBookingForm(prev => ({
      ...prev,
      room_ids: prev.room_ids.includes(roomId)
        ? prev.room_ids.filter(id => id !== roomId)
        : [...prev.room_ids, roomId]
    }));
  };
  const handleBookingSubmit = async e => {
    e.preventDefault();
    try {
      const bookingData = {
        ...bookingForm,
        package_id: parseInt(bookingForm.package_id),
        adults: parseInt(bookingForm.adults),
        children: parseInt(bookingForm.children),
        room_ids: bookingForm.room_ids.map(id => parseInt(id))
      };
      if (editingBooking) {
        await api.put(`/packages/bookings/${editingBooking.id}`, bookingData);
        toast.success("Booking updated successfully!");
        setEditingBooking(null);
      } else {
        await api.post("/packages/book", bookingData);
        toast.success("Package booked successfully!");
      }
      setBookingForm({ package_id: "", guest_name: "", guest_email: "", guest_mobile: "", check_in: "", check_out: "", adults: 2, children: 0, room_ids: [] });
      fetchData();
    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to process booking';
      toast.error(message);
    }
  };
  const handleEditBooking = booking => {
    setEditingBooking(booking);
    setBookingForm({
      package_id: booking.package?.id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email || "",
      guest_mobile: booking.guest_mobile || "",
      check_in: booking.check_in,
      check_out: booking.check_out,
      adults: booking.adults,
      children: booking.children,
      room_ids: booking.rooms.map(r => r.room.id)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleCancelBooking = async bookingId => {
    if (window.confirm("Are you sure you want to cancel this booking?")) {
      try {
        await api.delete(`/packages/booking/${bookingId}`);
        toast.success("Booking canceled successfully!");
        fetchData();
      } catch (err) {
        console.error(err);
        toast.error("Failed to cancel booking");
      }
    }
  };

  const handleCheckIn = async (bookingId, images) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Processing check-in...");

    const formData = new FormData();
    formData.append("id_card_image", images.id_card_image);
    formData.append("guest_photo", images.guest_photo);

    try {
      const response = await api.put(`/packages/booking/${bookingId}/check-in`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update the specific booking in the state
      setBookings(prevBookings =>
        prevBookings.map(b => (b.id === bookingId ? { ...b, ...response.data } : b))
      );

      toast.success("Guest checked in successfully!", { id: toastId });
      setBookingToCheckIn(null);
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to check in guest.';
      toast.error(message, { id: toastId });
      console.error("Check-in error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };
  // Filters
  const handlePackageFilterChange = e => setPackageFilter(e.target.value);
  const handleBookingFilterChange = e => setBookingFilter(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const filteredPackages = packages.filter(pkg => pkg.title.toLowerCase().includes(packageFilter.toLowerCase()));
  const filteredBookings = bookings.filter(b => {
    const matchesGuest = b.guest_name.toLowerCase().includes(bookingFilter.guestName.toLowerCase());
    const matchesStatus = bookingFilter.status === "all" || b.status === bookingFilter.status;
    const matchesCheckIn = !bookingFilter.checkIn || b.check_in >= bookingFilter.checkIn;
    const matchesCheckOut = !bookingFilter.checkOut || b.check_out <= bookingFilter.checkOut;
    return matchesGuest && matchesStatus && matchesCheckIn && matchesCheckOut;
  });

  const totalPackages = packages.length;
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.package?.price || 0), 0);

  // Charts
  const bookingCounts = filteredBookings.reduce((acc, b) => {
    const pkg = b.package?.title || "Unknown";
    acc[pkg] = (acc[pkg] || 0) + 1;
    return acc;
  }, {});
  const pieData = {
    labels: Object.keys(bookingCounts),
    datasets: [{
      data: Object.values(bookingCounts),
      backgroundColor: CHART_COLORS.map(color => `${color}B3`), // 0.7 opacity
      borderColor: CHART_COLORS,
      borderWidth: 2,
    }]
  };

  const monthlyData = bookings.reduce((acc, b) => {
    const date = new Date(b.check_in);
    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const barData = {
    labels: Object.keys(monthlyData),
    datasets: [{ label: 'Bookings per Month', data: Object.values(monthlyData), backgroundColor: 'rgba(53, 162, 235, 0.8)', borderColor: 'rgba(53, 162, 235, 1)', borderWidth: 1, borderRadius: 4 }]
  };

  const revenueData = bookings.reduce((acc, b) => {
    const date = new Date(b.check_in).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + (b.package?.price || 0);
    return acc;
  }, {});

  const sortedRevenueLabels = Object.keys(revenueData).sort();
  const sortedRevenueValues = sortedRevenueLabels.map(label => revenueData[label]);

  const lineData = {
    labels: sortedRevenueLabels,
    datasets: [{ label: 'Total Revenue', data: sortedRevenueValues, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', tension: 0.4, fill: true, pointBackgroundColor: 'rgba(75, 192, 192, 1)', pointBorderColor: '#fff', pointHoverRadius: 7 }]
  };

  if (loading) return <p className="text-center text-gray-600 font-serif">Loading packages, rooms, and bookings...</p>;

  return (
    <DashboardLayout>
      {/* Image Gallery Modal */}
      {selectedPackageImages && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPackageImages(null)}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{selectedPackageImages.title}</h2>
                <button onClick={() => setSelectedPackageImages(null)} className="text-gray-500 hover:text-gray-800">
                  <i className="fas fa-times text-2xl"></i>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedPackageImages.images.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img
                      src={getImageUrl(img.image_url)}
                      alt={`${selectedPackageImages.title} - Image ${idx + 1}`}
                      className="w-full h-64 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(getImageUrl(img.image_url), '_blank')}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center text-gray-600">
                <p>Click on any image to view in full size</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <h1 className="text-3xl font-bold text-gray-800 mb-6">Package Management</h1>

      {/* KPI Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <KpiCard title="Total Packages" value={totalPackages} color="bg-gradient-to-r from-blue-500 to-blue-700" icon={<i className="fas fa-box-open"></i>} />
        <KpiCard title="Total Bookings" value={totalBookings} color="bg-gradient-to-r from-green-500 to-green-700" icon={<i className="fas fa-calendar-check"></i>} />
        <KpiCard title="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} color="bg-gradient-to-r from-purple-500 to-purple-700" icon={<i className="fas fa-rupee-sign"></i>} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12">
        <Card title="Bookings by Package" className="lg:col-span-1">
          <div className="h-80 w-full">
            <Pie data={pieData} options={{ ...commonChartOptions, plugins: { ...commonChartOptions.plugins, legend: { position: 'bottom' } } }} />
          </div>
        </Card>
        <Card title="Monthly Bookings" className="lg:col-span-2">
          <div className="h-80 w-full">
            <Bar data={barData} options={commonChartOptions} />
          </div>
        </Card>
      </div>
      <Card title="Revenue Over Time" className="mb-8 md:mb-12">
        <div className="h-96 w-full">
          <Line data={lineData} options={commonChartOptions} />
        </div>
      </Card>

      {/* Packages List Section */}
      <Card title="Available Packages">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search for a package..."
            value={packageFilter}
            onChange={handlePackageFilterChange}
            className="w-full md:w-1/2 p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPackages.length > 0 ? (
            filteredPackages.map(pkg => (
              <motion.div key={pkg.id} whileHover={{ y: -5 }} className="bg-gray-50 rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300 flex flex-col">
                {pkg.images && pkg.images.length > 0 ? (
                  <div className="relative">
                    <img className="h-48 w-full object-cover cursor-pointer" src={getImageUrl(pkg.images[0].image_url)} alt={pkg.title} onClick={() => setSelectedPackageImages(pkg)} />
                    {pkg.images.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        +{pkg.images.length - 1} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-48 w-full bg-gray-200 flex items-center justify-center"><span className="text-gray-500">No Image</span></div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  <h4 className="font-bold text-xl mb-2 text-gray-800">{pkg.title}</h4>
                  <p className="text-gray-600 text-base mb-3 flex-grow">{pkg.description}</p>
                  
                  {/* Booking Type and Room Types Info */}
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500">Booking Type:</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        pkg.booking_type === 'whole_property' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {pkg.booking_type === 'whole_property' ? 'Whole Property' : pkg.booking_type === 'room_type' ? 'Selected Rooms' : 'Room Type'}
                      </span>
                    </div>
                    {pkg.room_types && pkg.room_types.trim().length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-semibold text-gray-500">Room Types:</span>
                        <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded">{pkg.room_types}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-200">
                    <p className="text-green-600 font-bold text-2xl">₹{pkg.price.toLocaleString()}</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleEditPackage(pkg)} className="text-blue-500 hover:text-blue-700 font-semibold transition-colors duration-300 flex items-center gap-2"><i className="fas fa-edit"></i> Edit</button>
                      <button onClick={() => handleDeletePackage(pkg.id)} className="text-red-500 hover:text-red-700 font-semibold transition-colors duration-300 flex items-center gap-2"><i className="fas fa-trash-alt"></i> Delete</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <p className="text-center text-gray-500 col-span-full py-8">No packages found matching your search.</p>
          )}
        </div>
      </Card>

      {/* Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">

        {/* Edit Package Form */}
        {editingPackage && (
          <Card title={`Edit Package: ${editingPackage.title}`}>
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <input type="text" name="title" placeholder="Package Title" value={editForm.title} onChange={handleEditChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
              <textarea name="description" placeholder="Package Description" value={editForm.description} onChange={handleEditChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" rows="4" required />
              <input type="number" name="price" placeholder="Price (₹)" value={editForm.price} onChange={handleEditChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
              
              {/* Booking Type Selection */}
              <div className="space-y-3">
                <label className="block text-gray-700 font-medium">Booking Type</label>
                <div className="flex flex-col space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="booking_type"
                      value="whole_property"
                      checked={editForm.booking_type === "whole_property"}
                      onChange={handleEditChange}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">Whole Property (Book entire property)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="booking_type"
                      value="room_type"
                      checked={editForm.booking_type === "room_type"}
                      onChange={handleEditChange}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700">Selected Room Type (Book specific room types)</span>
                  </label>
                </div>
              </div>

              {/* Room Type Selection (only show if booking_type is room_type) */}
              {editForm.booking_type === "room_type" && (
                <div className="space-y-3">
                  <label className="block text-gray-700 font-medium">Select Room Types</label>
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {uniqueRoomTypes.length > 0 ? (
                      uniqueRoomTypes.map((roomType) => (
                        <label key={roomType} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                          <input
                            type="checkbox"
                            name="room_type"
                            value={roomType}
                            checked={editForm.selected_room_types?.includes(roomType) || false}
                            onChange={handleEditChange}
                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
                          />
                          <span className="text-sm text-gray-700">{roomType}</span>
                        </label>
                      ))
                    ) : (
                      <div className="col-span-2 text-sm text-gray-500 text-center py-2">
                        No room types available
                      </div>
                    )}
                  </div>
                  {editForm.selected_room_types && editForm.selected_room_types.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Selected: {editForm.selected_room_types.join(", ")}
                    </p>
                  )}
                </div>
              )}
              
              <label className="block">
                <span className="text-gray-600 font-medium">Add New Images (Optional):</span>
                <input type="file" multiple accept="image/*" onChange={handleEditImageChange} className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all" />
                {editSelectedFiles.length > 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    {editSelectedFiles.length} new image{editSelectedFiles.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </label>
              {editImagePreviews.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600 font-medium mb-2">Image Previews (Existing + New):</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {editImagePreviews.map((src, index) => (
                      <div key={index} className="relative group">
                        <img src={src} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg shadow-md" />
                        <button
                          type="button"
                          onClick={() => handleRemoveEditImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Remove image"
                        >
                          ×
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setEditingPackage(null); setEditForm({ title: "", description: "", price: "", booking_type: "room_type", selected_room_types: [], images: [] }); setEditImagePreviews([]); setEditSelectedFiles([]); }} className="w-1/2 bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:-translate-y-1">Cancel</button>
                <button type="submit" className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:-translate-y-1">Update Package ✏️</button>
              </div>
            </form>
          </Card>
        )}

        {/* Create Package Form */}
        {!editingPackage && (
          <Card title="Create New Package">
          <form onSubmit={handleCreateSubmit} className="space-y-6">
            <input type="text" name="title" placeholder="Package Title" value={createForm.title} onChange={handleCreateChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
            <textarea name="description" placeholder="Package Description" value={createForm.description} onChange={handleCreateChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" rows="4" required />
            <input type="number" name="price" placeholder="Price (₹)" value={createForm.price} onChange={handleCreateChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
            
            {/* Booking Type Selection */}
            <div className="space-y-3">
              <label className="block text-gray-700 font-medium">Booking Type</label>
              <div className="flex flex-col space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="booking_type"
                    value="whole_property"
                    checked={createForm.booking_type === "whole_property"}
                    onChange={handleCreateChange}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">Whole Property (Book entire property)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="booking_type"
                    value="room_type"
                    checked={createForm.booking_type === "room_type"}
                    onChange={handleCreateChange}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">Selected Room Type (Book specific room types)</span>
                </label>
              </div>
            </div>

            {/* Room Type Selection (only show if booking_type is room_type) */}
            {createForm.booking_type === "room_type" && (
              <div className="space-y-3">
                <label className="block text-gray-700 font-medium">Select Room Types</label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {uniqueRoomTypes.length > 0 ? (
                    uniqueRoomTypes.map((roomType) => (
                      <label key={roomType} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                        <input
                          type="checkbox"
                          name="room_type"
                          value={roomType}
                          checked={createForm.selected_room_types?.includes(roomType) || false}
                          onChange={handleCreateChange}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
                        />
                        <span className="text-sm text-gray-700">{roomType}</span>
                      </label>
                    ))
                  ) : (
                    <div className="col-span-2 text-sm text-gray-500 text-center py-2">
                      No room types available
                    </div>
                  )}
                </div>
                {createForm.selected_room_types && createForm.selected_room_types.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Selected: {createForm.selected_room_types.join(", ")}
                  </p>
                )}
              </div>
            )}
            
            <label className="block">
              <span className="text-gray-600 font-medium">Package Images (Select multiple):</span>
              <input type="file" multiple accept="image/*" onChange={handleCreateImageChange} className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-all" />
              {selectedFiles.length > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  {selectedFiles.length} image{selectedFiles.length > 1 ? 's' : ''} selected
                </p>
              )}
            </label>
            {imagePreviews.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 font-medium mb-2">Image Previews:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {imagePreviews.map((src, index) => (
                    <div key={index} className="relative group">
                      <img src={src} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg shadow-md" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove image"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:-translate-y-1">Create Package 🚀</button>
          </form>
        </Card>
        )}

        {/* Booking Form */}
        <Card title={editingBooking ? "Edit Booking" : "Book a Package"}>
          <form onSubmit={handleBookingSubmit} className="space-y-6">
            <select name="package_id" value={bookingForm.package_id} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required>
              <option value="">Select Package</option>
              {packages.map(p => (<option key={p.id} value={p.id}>{p.title} - ₹{p.price}</option>))}
            </select>
            <input name="guest_name" placeholder="Guest Name" value={bookingForm.guest_name} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
            <input type="email" name="guest_email" placeholder="Guest Email" value={bookingForm.guest_email} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" />
            <input name="guest_mobile" placeholder="Guest Mobile" value={bookingForm.guest_mobile} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="date" name="check_in" value={bookingForm.check_in} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
              <input type="date" name="check_out" value={bookingForm.check_out} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="number" name="adults" min={1} placeholder="Adults" value={bookingForm.adults} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" required />
              <input type="number" name="children" min={0} placeholder="Children" value={bookingForm.children} onChange={handleBookingChange} className="w-full p-3 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all" />
            </div>
            {/* Room Selection - Only show for room_type packages */}
            {(() => {
              const selectedPackage = packages.find(p => p.id === parseInt(bookingForm.package_id));
              const isWholeProperty = selectedPackage && selectedPackage.booking_type === 'whole_property';
              
              // Hide room selection completely for whole_property
              if (isWholeProperty) {
                return (
                  <div className="bg-indigo-50 border-2 border-indigo-300 rounded-lg p-4">
                    <p className="text-sm font-semibold text-indigo-800">Whole Property Package</p>
                    <p className="text-xs text-indigo-600 mt-1">
                      All available rooms ({availableRooms.length} room{availableRooms.length !== 1 ? 's' : ''}) will be booked automatically for the selected dates.
                    </p>
                  </div>
                );
              }
              
              // Show room selection for room_type packages
              return (
                <div>
                  <label className="block text-gray-600 font-medium mb-2">
                    Select Rooms for Package
                    {bookingForm.check_in && bookingForm.check_out && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({bookingForm.check_in} to {bookingForm.check_out})
                      </span>
                    )}
                  </label>
                  {!bookingForm.check_in || !bookingForm.check_out ? (
                    <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border">
                      <p>Please select check-in and check-out dates first</p>
                      <p className="text-xs mt-1">Available rooms will be shown here</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-lg border">
                      {availableRooms.length > 0 ? (
                        availableRooms.map(room => (
                          <div 
                            key={room.id} 
                            onClick={() => handleRoomSelect(room.id)} 
                            className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                              ${bookingForm.room_ids.includes(room.id) 
                                ? 'bg-indigo-500 text-white border-indigo-600' 
                                : 'bg-white border-gray-300 hover:border-indigo-500'
                              }
                            `}
                          >
                            <p className="font-semibold">Room {room.number}</p>
                            <p className={`text-sm ${bookingForm.room_ids.includes(room.id) ? 'text-indigo-200' : 'text-gray-600'}`}>{room.type}</p>
                            <p className={`text-xs ${bookingForm.room_ids.includes(room.id) ? 'text-indigo-200' : 'text-gray-500'}`}>₹{room.price}/night</p>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full text-center py-4 text-gray-500">
                          <p className="font-medium">No rooms available for the selected dates</p>
                          <p className="text-sm mt-1">Please try different dates</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-transform transform hover:-translate-y-1">
              {editingBooking ? "Update Booking ✏️" : "Book Package ✅"}
            </button>
          </form>
        </Card>
      </div>

      {/* Bookings Table */}
      <Card title="All Package Bookings" className="mt-8">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rooms</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-In</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-Out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{b.guest_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.package?.title || "-"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.rooms.map(r => r.room.number).join(", ")}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.check_in}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{b.check_out}</td>
                  <td className="px-4 py-3 whitespace-nowrap capitalize">{b.status}</td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => handleEditBooking(b)} className="text-blue-600 hover:text-blue-800 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed" disabled={b.status !== 'booked'}>
                      Edit
                    </button>
                    <button onClick={() => handleCancelBooking(b.id)} className="text-red-600 hover:text-red-800 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed" disabled={b.status !== 'booked'}>
                      Cancel
                    </button>
                    <button onClick={() => setBookingToCheckIn(b)} className="text-green-600 hover:text-green-800 font-semibold disabled:text-gray-400 disabled:cursor-not-allowed" disabled={b.status !== 'booked'}>
                      Check-in
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-4 text-gray-500">No bookings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {bookingToCheckIn && (
        <CheckInModal
          booking={bookingToCheckIn}
          onClose={() => setBookingToCheckIn(null)}
          onSave={handleCheckIn}
          isSubmitting={isSubmitting}
        />
      )}
    </DashboardLayout>
  );
};

export default Packages;
