import React, { useEffect, useState, useMemo } from "react";
import { formatCurrency } from '../utils/currency';
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import { motion } from "framer-motion";
import { Calendar, User, DollarSign, Utensils, ConciergeBell, BedDouble, Package, AlertCircle, Search } from "lucide-react";

// Helper to get an icon based on activity type
const getActivityIcon = (type) => {
  switch (type) {
    case "Room Booking": return <BedDouble className="w-5 h-5 text-purple-500" />;
    case "Package Booking": return <Package className="w-5 h-5 text-indigo-500" />;
    case "Food Order": return <Utensils className="w-5 h-5 text-orange-500" />;
    case "Service": return <ConciergeBell className="w-5 h-5 text-teal-500" />;
    case "Expense": return <DollarSign className="w-5 h-5 text-red-500" />;
    default: return <Calendar className="w-5 h-5 text-gray-500" />;
  }
};

const ActivitySection = ({ title, activities, icon }) => {
  if (!activities || activities.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-xl shadow-md"
    >
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        {icon}
        <span className="ml-2">{title} ({activities.length})</span>
      </h3>
      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {activities.map((activity, index) => (
          <ActivityCard key={index} activity={activity} />
        ))}
      </div>
    </motion.div>
  );
};

const UserHistory = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Assuming /employees endpoint returns all employees
        const response = await api.get("/employees");
        setUsers(response.data || []);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setError("Could not load the list of users.");
      }
    };
    fetchUsers();
  }, []);

  const handleFetchHistory = async () => {
    if (!selectedUserId) {
      setError("Please select a user to view their history.");
      return;
    }
    setLoading(true);
    setError("");
    setHistory(null);

    try {
      const params = { user_id: selectedUserId };
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;

      const response = await api.get("/reports/user-history", { params });
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to fetch user history:", err);
      setError(err.response?.data?.detail || "An error occurred while fetching the history.");
    } finally {
      setLoading(false);
    }
  };

  const categorizedActivities = useMemo(() => {
    if (!history) return {};
    return history.activities.reduce((acc, activity) => {
      const type = activity.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(activity);
      return acc;
    }, {});
  }, [history]);

  return (
    <DashboardLayout>
      <div className="p-6 md:p-8 space-y-8 bg-gray-50 min-h-screen">
        <h1 className="text-3xl font-bold text-gray-800">User Activity History</h1>

        {/* Filter Section */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-1">
                Select User
              </label>
              <select
                id="user-select"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select a User --</option>
                {users.map((user) => (
                  <option key={user.id} value={user.user_id || user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="from-date" className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" id="from-date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="to-date" className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" id="to-date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={handleFetchHistory}
              disabled={loading || !selectedUserId}
              className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Search size={18} className="mr-2" />
              {loading ? 'Fetching...' : 'Get History'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg flex items-center">
            <AlertCircle size={20} className="mr-3" />
            {error}
          </div>
        )}

        {/* History Timeline */}
        {history && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-6 rounded-xl shadow-md mt-8"
          >
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Activity for <span className="text-indigo-600">{history.user_name}</span>
            </h2>
            {history.activities.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                <ActivitySection title="Room Bookings" activities={categorizedActivities['Room Booking']} icon={<BedDouble className="w-6 h-6 text-purple-500" />} />
                <ActivitySection title="Package Bookings" activities={categorizedActivities['Package Booking']} icon={<Package className="w-6 h-6 text-indigo-500" />} />
                <ActivitySection title="Food Orders" activities={categorizedActivities['Food Order']} icon={<Utensils className="w-6 h-6 text-orange-500" />} />
                <ActivitySection title="Services" activities={categorizedActivities['Service']} icon={<ConciergeBell className="w-6 h-6 text-teal-500" />} />
                <ActivitySection title="Expenses" activities={categorizedActivities['Expense']} icon={<DollarSign className="w-6 h-6 text-red-500" />} />
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No activities found for this user in the selected date range.</p>
            )}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

const ActivityCard = ({ activity }) => (
  <div className="p-4 border rounded-lg bg-gray-50/50 hover:bg-white hover:shadow-sm transition-all duration-200">
    <div className="flex items-start gap-3">
      <div className="mt-1">{getActivityIcon(activity.type)}</div>
      <div>
        <p className="text-xs text-gray-500">{new Date(activity.activity_date).toLocaleString()}</p>
        <h4 className="font-bold text-gray-800">{activity.type}</h4>
        <p className="text-sm text-gray-600">{activity.description}</p>
        <div className="text-xs mt-2 flex items-center gap-4 flex-wrap">
          {activity.amount != null && <span className="font-semibold text-green-600">Amount: {formatCurrency(activity.amount)}</span>}
          {activity.status && <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-800 font-medium">{activity.status}</span>}
        </div>
      </div>
    </div>
  </div>
);

export default UserHistory;