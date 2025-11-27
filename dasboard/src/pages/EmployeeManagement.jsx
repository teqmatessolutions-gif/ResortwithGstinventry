import React, { useEffect, useState, useMemo } from "react";
import { formatCurrency } from '../utils/currency';
import DashboardLayout from "../layout/DashboardLayout";
import api from "../services/api";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, User, DollarSign, Utensils, ConciergeBell, BedDouble, Package, AlertCircle, Search, UserCheck, Briefcase, Clock, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import CountUp from "react-countup";
import BannerMessage from "../components/BannerMessage";
import { getMediaBaseUrl } from "../utils/env";

const UserHistory = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mediaBaseUrl = useMemo(() => getMediaBaseUrl(), []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Fetch both users and employees to show all users including admins
        const [usersRes, employeesRes] = await Promise.all([
          api.get("/users/"),
          api.get("/employees")
        ]);
        
        const users = usersRes.data || [];
        const employees = employeesRes.data || [];
        
        // Create a map of employees by user_id for quick lookup
        const employeeMap = new Map();
        employees.forEach(emp => {
          if (emp.user_id) {
            employeeMap.set(emp.user_id, emp);
          }
        });
        
        // Combine users with their employee data
        const combinedUsers = users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role?.name || 'Unknown',
          phone: user.phone,
          is_active: user.is_active,
          // Add employee-specific data if available
          salary: employeeMap.get(user.id)?.salary || null,
          join_date: employeeMap.get(user.id)?.join_date || null,
          image_url: employeeMap.get(user.id)?.image_url || null,
          has_employee_record: employeeMap.has(user.id)
        }));
        
        setUsers(combinedUsers);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      }
    };
    fetchUsers();
  }, []);

  const handleFetchHistory = async () => {
    if (!selectedUserId) return;
    setLoading(true);
    setError("");
    setHistory(null);
    try {
      // Build params object, only including dates if they have values
      const params = {
        user_id: selectedUserId
      };
      if (fromDate && fromDate.trim() !== "") {
        params.from_date = fromDate;
      }
      if (toDate && toDate.trim() !== "") {
        params.to_date = toDate;
      }
      
      const response = await api.get("/reports/user-history", { params });
      setHistory(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-gray-50 p-4 rounded-lg">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full p-2 border rounded-md">
            <option value="">-- Select a User --</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role}) {!user.has_employee_record ? '(Admin)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-2 border rounded-md" />
        </div>
      </div>
      <button onClick={handleFetchHistory} disabled={loading || !selectedUserId} className="w-full bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-400">
        {loading ? 'Fetching...' : 'Get Activity Report'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
      {history && (
        <div className="mt-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Activity for {history.user_name}</h3>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {history.activities.length > 0 ? history.activities.map((activity, index) => (
              <div key={index} className="p-3 border rounded-lg bg-white shadow-sm">
                <p className="text-xs text-gray-500">{new Date(activity.activity_date).toLocaleString()}</p>
                <h4 className="font-bold">{activity.type}</h4>
                <p className="text-sm">{activity.description}</p>
                {activity.amount != null && <span className="text-sm font-semibold text-green-600">Amount: {formatCurrency(activity.amount)}</span>}
              </div>
            )) : <p>No activities found.</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const LeaveManagement = () => {
    const [leaves, setLeaves] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [leaveForm, setLeaveForm] = useState({
        employee_id: '',
        from_date: '',
        to_date: '',
        reason: '',
        leave_type: 'Paid' // Default to 'Paid'
    });

    useEffect(() => {
        api.get('/employees').then(res => setEmployees(res.data));
    }, []);

    useEffect(() => {
        if (selectedEmployeeId) {
            // When a user is selected to view leaves, also set it for the create form
            setLeaveForm(prev => ({ ...prev, employee_id: selectedEmployeeId }));
            api.get(`/employees/leave/${selectedEmployeeId}`)
               .then(res => setLeaves(res.data))
               .catch(err => console.error("Failed to fetch leaves", err));
        } else {
            setLeaves([]);
        }
    }, [selectedEmployeeId]);

    const handleStatusUpdate = (leaveId, status) => {
        api.put(`/employees/leave/${leaveId}/status/${status}`).then(res => {
            setLeaves(leaves.map(l => l.id === leaveId ? res.data : l));
        });
    };

    const handleLeaveFormChange = (e) => {
        setLeaveForm({ ...leaveForm, [e.target.name]: e.target.value });
    };

    const handleCreateLeave = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/employees/leave', leaveForm);
            // If the new leave belongs to the currently viewed employee, add it to the list
            if (response.data.employee_id === parseInt(selectedEmployeeId)) {
                setLeaves([response.data, ...leaves]);
            }
            // Reset form and hide it
            setLeaveForm({ employee_id: '', from_date: '', to_date: '', reason: '', leave_type: 'Paid' });
            setShowCreateForm(false);
        } catch (err) {
            console.error("Failed to create leave", err);
            alert("Failed to create leave request.");
        }
    };

    return (
        <div className="space-y-4">
            {/* Create Leave Form Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <button onClick={() => setShowCreateForm(!showCreateForm)} className="font-semibold text-indigo-600">
                    {showCreateForm ? '▼ Hide Form' : '▶ Create Leave Entry'}
                </button>
                {showCreateForm && (
                    <motion.form onSubmit={handleCreateLeave} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-3">
                        <select name="employee_id" value={leaveForm.employee_id} onChange={handleLeaveFormChange} className="w-full p-2 border rounded-md" required>
                            <option value="">-- Select Employee --</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                        <select name="leave_type" value={leaveForm.leave_type} onChange={handleLeaveFormChange} className="w-full p-2 border rounded-md" required>
                            <option value="Paid">Paid Leave</option>
                            <option value="Sick">Sick Leave</option>
                            <option value="Unpaid">Unpaid Leave</option>
                        </select>
                        <div className="grid grid-cols-2 gap-4">
                            <input type="date" name="from_date" value={leaveForm.from_date} onChange={handleLeaveFormChange} className="w-full p-2 border rounded-md" required />
                            <input type="date" name="to_date" value={leaveForm.to_date} onChange={handleLeaveFormChange} className="w-full p-2 border rounded-md" required />
                        </div>
                        <input type="text" name="reason" placeholder="Reason for leave" value={leaveForm.reason} onChange={handleLeaveFormChange} className="w-full p-2 border rounded-md" required />
                        <button type="submit" className="w-full bg-green-600 text-white px-4 py-2 rounded-md">Submit Leave</button>
                    </motion.form>
                )}
            </div>

            {/* View Leaves Section */}
            <h3 className="text-lg font-semibold pt-4 border-t">View Existing Leaves</h3>
            <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full p-2 border rounded-md">
                <option value="">Select Employee to view leaves</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
            <div className="overflow-x-auto max-h-96">
                {selectedEmployeeId && leaves.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No leave records found for this employee.</p>
                )}
                <table className="min-w-full bg-white">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="py-2 px-4">From</th>
                            <th className="py-2 px-4">To</th>
                            <th className="py-2 px-4">Reason</th>
                            <th className="py-2 px-4">Type</th>
                            <th className="py-2 px-4">Status</th>
                            <th className="py-2 px-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leaves.length > 0 && leaves.map(leave => (
                            <tr key={leave.id} className="border-b">
                                <td className="py-2 px-4">{leave.from_date}</td>
                                <td className="py-2 px-4">{leave.to_date}</td>
                                <td className="py-2 px-4">{leave.reason}</td>
                                <td className="py-2 px-4">{leave.leave_type}</td>
                                <td className="py-2 px-4">{leave.status}</td>
                                <td className="py-2 px-4 space-x-2">
                                    {leave.status === 'pending' && (
                                        <>
                                            <button onClick={() => handleStatusUpdate(leave.id, 'approved')} className="text-green-600">Approve</button>
                                            <button onClick={() => handleStatusUpdate(leave.id, 'rejected')} className="text-red-600">Reject</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AttendanceTracking = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [workLogs, setWorkLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [bannerMessage, setBannerMessage] = useState({ type: null, text: "" });

  // Function to show banner message
  const showBannerMessage = (type, text) => {
    setBannerMessage({ type, text });
  };

  const closeBannerMessage = () => {
    setBannerMessage({ type: null, text: "" });
  };

  const [location, setLocation] = useState('Office'); // For live clock-in/out
  // State to manage which day's detailed logs are shown
  const [selectedDay, setSelectedDay] = useState(null); // Stores the date string of the expanded day

  useEffect(() => {
    api.get('/employees').then(res => setEmployees(res.data));
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      setLoading(true);
      api.get(`/attendance/work-logs/${selectedEmployeeId}`).then(res => { // This endpoint provides duration_hours
        setWorkLogs(res.data || []);
        if (!res.data || res.data.length === 0) {
          console.log("No work logs found for this employee");
        }
      }).catch(err => {
        console.error("Failed to fetch data", err);
        const errorMsg = err.response?.data?.detail;
        const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to fetch employee records';
        showBannerMessage("error", message);
        setWorkLogs([]);
      }).finally(() => setLoading(false));
    } else {
      setWorkLogs([]);
    }
  }, [selectedEmployeeId]);

  const showMessage = (text, type) => {
    showBannerMessage(type, text);
  };

  const handleClockIn = async () => {
    if (!selectedEmployeeId) return showMessage('Please select an employee.', 'error');
    try {
      const response = await api.post('/attendance/clock-in', { employee_id: selectedEmployeeId, location });
      setWorkLogs([response.data, ...workLogs]);
      showMessage('Clocked in successfully.', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to clock in.';
      showMessage(message, 'error');
    }
  };

  const handleClockOut = async () => {
    if (!selectedEmployeeId) return showMessage('Please select an employee.', 'error');
    
    // Check if there's an open clock-in before attempting clock-out
    const hasOpenClockIn = workLogs.some(log => 
      log.check_out_time === null || log.check_out_time === undefined
    );
    
    if (!hasOpenClockIn) {
      return showMessage('Please clock in first before clocking out.', 'error');
    }
    
    try {
      // Corrected to use POST and send employee_id in the body, matching the backend implementation
      const response = await api.post('/attendance/clock-out', { employee_id: selectedEmployeeId });
      // Update the log in the state with the returned data which includes the check_out_time
      setWorkLogs(workLogs.map(log => log.id === response.data.id ? response.data : log).sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id));
      showMessage('Clocked out successfully.', 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.detail;
      const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to clock out.';
      showMessage(message, 'error');
    }
  };

  const dailyAttendance = useMemo(() => {
    const dailySummary = workLogs.reduce((acc, log) => {
      const date = log.date;
      if (!acc[date]) {
        acc[date] = { totalHours: 0, logs: [], completedLogs: [], openLogs: [] };
      }
      const hours = log.duration_hours || 0;
      acc[date].totalHours += hours;
      acc[date].logs.push(log);
      
      // Separate completed and open logs for better display
      if (log.check_out_time && hours > 0) {
        acc[date].completedLogs.push(log);
      } else if (!log.check_out_time) {
        acc[date].openLogs.push(log);
      }
      
      return acc;
    }, {});

    return Object.entries(dailySummary).map(([date, data]) => {
      const totalHours = data.totalHours;
      let status = 'Absent';
      let statusDescription = '';
      
      // Determine status based on total working hours
      if (totalHours >= 8) {
        status = 'Present';
        statusDescription = 'Full Day Present (8+ hours)';
      } else if (totalHours >= 4 && totalHours < 8) {
        status = 'Half Day';
        statusDescription = 'Half Day (4-8 hours)';
      } else if (totalHours > 0 && totalHours < 4) {
        status = 'Partial';
        statusDescription = `Partial Day (${totalHours.toFixed(2)} hours)`;
      } else {
        status = 'Absent';
        statusDescription = 'No attendance recorded';
      }
      
      // Calculate summary stats
      const completedHours = data.completedLogs.reduce((sum, log) => sum + (log.duration_hours || 0), 0);
      const openLogsCount = data.openLogs.length;
      const completedLogsCount = data.completedLogs.length;
      
      return { 
        date, 
        totalHours, 
        status, 
        statusDescription,
        logs: data.logs,
        completedLogs: data.completedLogs,
        openLogs: data.openLogs,
        completedHours,
        completedLogsCount,
        openLogsCount
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [workLogs]);

  const getStatusColor = (status) => {
    if (status === 'Present') return 'bg-green-100 text-green-800 border-green-300';
    if (status === 'Half Day') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (status === 'Partial') return 'bg-orange-100 text-orange-800 border-orange-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };


  return (
    <div className="space-y-6">
      <BannerMessage 
        message={bannerMessage} 
        onClose={closeBannerMessage}
        autoDismiss={true}
        duration={5000}
      />
      <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full p-2 border rounded-md">
        <option value="">-- Select an Employee --</option>
        {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
      </select>

      {selectedEmployeeId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Live Clock-in/Out Section */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="text-lg font-semibold">Live Attendance</h3>
            
            {/* Status Indicator */}
            {(() => {
              const hasOpenClockIn = workLogs.some(log => log.check_out_time === null || log.check_out_time === undefined);
              return (
                <div className={`p-2 rounded-md text-center text-sm font-semibold ${hasOpenClockIn ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  Status: {hasOpenClockIn ? '🟢 Clocked In' : '⚪ Not Clocked In'}
                </div>
              );
            })()}
            
            <div className="space-y-2">
              <label htmlFor="location-select" className="block text-sm font-medium text-gray-700">Location</label>
              <select id="location-select" value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 border rounded-md">
                <option>Office</option>
                <option>Remote</option>
                <option>On-Site</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <button onClick={handleClockIn} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Clock In</button>
              <button onClick={handleClockOut} className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Clock Out</button>
            </div>
          </div>

          {/* Calculated Attendance Report */}
          <div className="bg-white p-4 rounded-lg space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Daily Attendance Summary</h3>
              {!loading && workLogs.length > 0 && (
                <div className="text-xs text-gray-500">
                  <span className="font-semibold">Total Records:</span> {workLogs.length}
                </div>
              )}
            </div>
            {loading && <p className="text-center text-gray-500">Loading attendance records...</p>}
            {!loading && workLogs.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600 font-medium">No attendance records found for this employee.</p>
                <p className="text-sm text-gray-500 mt-2">Use the Clock In button above to create attendance records.</p>
              </div>
            )}
            {!loading && workLogs.length > 0 && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {(() => {
                  const totalDays = dailyAttendance.length;
                  const presentDays = dailyAttendance.filter(d => d.status === 'Present').length;
                  const halfDays = dailyAttendance.filter(d => d.status === 'Half Day').length;
                  const totalHours = dailyAttendance.reduce((sum, d) => sum + d.totalHours, 0);
                  
                  return (
                    <>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-600 font-medium">Total Days</p>
                        <p className="text-lg font-bold text-blue-800">{totalDays}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-xs text-green-600 font-medium">Present Days</p>
                        <p className="text-lg font-bold text-green-800">{presentDays}</p>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <p className="text-xs text-yellow-600 font-medium">Half Days</p>
                        <p className="text-lg font-bold text-yellow-800">{halfDays}</p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                        <p className="text-xs text-purple-600 font-medium">Total Hours</p>
                        <p className="text-lg font-bold text-purple-800">{totalHours.toFixed(2)}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Attendance Table */}
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="min-w-full bg-white text-sm">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Date</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Total Hours</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Status</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Sessions</th>
                      <th className="py-3 px-4 text-left font-semibold text-gray-700 border-b">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyAttendance.map(day => (
                      <React.Fragment key={day.date}>
                        <tr
                          className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => setSelectedDay(selectedDay === day.date ? null : day.date)}
                        >
                          <td className="py-3 px-4 font-medium text-gray-800">
                            {new Date(day.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900">{day.totalHours.toFixed(2)} hrs</span>
                              {day.completedHours > 0 && day.openLogsCount > 0 && (
                                <span className="text-xs text-gray-500">
                                  {day.completedHours.toFixed(2)} completed
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className={`px-3 py-1 rounded-md text-xs font-semibold border ${getStatusColor(day.status)}`}>
                                {day.status}
                              </span>
                              <span className="text-xs text-gray-500">{day.statusDescription}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs">
                                <span className="font-semibold text-green-600">{day.completedLogsCount}</span> completed
                              </span>
                              {day.openLogsCount > 0 && (
                                <span className="text-xs">
                                  <span className="font-semibold text-orange-600">{day.openLogsCount}</span> open
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                              {selectedDay === day.date ? '▲ Hide Details' : '▼ Show Details'}
                            </button>
                          </td>
                        </tr>
                        {selectedDay === day.date && (
                          <tr>
                            <td colSpan="5" className="p-0 bg-gray-50">
                              <div className="p-4 border-t-2 border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-semibold text-gray-800">Detailed Logs for {day.date}</h4>
                                  <span className="text-xs text-gray-500">
                                    Total: {day.totalHours.toFixed(2)} hours | 
                                    Completed: {day.completedHours.toFixed(2)} hours
                                    {day.openLogsCount > 0 && ` | Open: ${day.openLogsCount} session(s)`}
                                  </span>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full bg-white text-xs border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700 border-b">Check-in Time</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700 border-b">Check-out Time</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700 border-b">Location</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700 border-b">Duration</th>
                                        <th className="py-2 px-3 text-left font-semibold text-gray-700 border-b">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day.logs.length > 0 ? day.logs.map((log, logIndex) => {
                                        const isOpen = !log.check_out_time;
                                        const hours = log.duration_hours || 0;
                                        return (
                                          <tr key={logIndex} className={`border-b last:border-b-0 ${isOpen ? 'bg-orange-50' : ''}`}>
                                            <td className="py-2 px-3 font-medium">{log.check_in_time || 'N/A'}</td>
                                            <td className="py-2 px-3">
                                              {log.check_out_time || (
                                                <span className="text-orange-600 font-medium">In Progress...</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                {log.location || 'N/A'}
                                              </span>
                                            </td>
                                            <td className="py-2 px-3">
                                              {hours > 0 ? (
                                                <span className="font-semibold">{hours.toFixed(2)} hrs</span>
                                              ) : (
                                                <span className="text-gray-400">-</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3">
                                              {isOpen ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                                  Open
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                  Completed
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      }) : (
                                        <tr>
                                          <td colSpan="5" className="py-4 text-center text-gray-500">
                                            No logs available for this date
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MonthlyReport = () => {
    const [employees, setEmployees] = useState([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

    useEffect(() => {
        api.get('/employees').then(res => setEmployees(res.data));
    }, []);

    useEffect(() => {
        if (selectedEmployeeId) {
            fetchReport();
        }
    }, [selectedEmployeeId, date]);

    const fetchReport = async () => {
        if (!selectedEmployeeId) return;
        setLoading(true);
        const [yearStr, monthStr] = date.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        try {
            const response = await api.get(`/attendance/monthly-report/${selectedEmployeeId}`, {
                params: { year, month }
            });
            setReport(response.data);
        } catch (error) {
            console.error("Failed to fetch monthly report", error);
            const errorMsg = error.response?.data?.detail;
            const message = typeof errorMsg === 'string' ? errorMsg : 'Failed to load monthly report';
            console.error(message);
            setReport(null);
        } finally {
            setLoading(false);
        }
    };

    const ReportCard = ({ title, value, colorClass }) => (
        <div className={`p-4 rounded-lg shadow ${colorClass}`}>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full p-2 border rounded-md">
                    <option value="">-- Select Employee --</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
                <input type="month" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-md" />
            </div>

            {loading && <p>Loading report...</p>}

            {report && !loading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <h3 className="text-xl font-bold">Monthly Report for {report.year && report.month ? new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) : date}</h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ReportCard title="Total Days" value={report.total_days || 0} colorClass="bg-blue-100 text-blue-800" />
                        <ReportCard title="Present Days" value={report.present_days || 0} colorClass="bg-green-100 text-green-800" />
                        <ReportCard title="Paid Leaves" value={report.paid_leaves_taken || 0} colorClass="bg-yellow-100 text-yellow-800" />
                        <ReportCard title="Unpaid/Absent" value={report.unpaid_leaves || 0} colorClass="bg-red-100 text-red-800" />
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="font-semibold mb-2">Annual Leave Balance</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="font-medium">Paid Leave</p>
                                <p>Balance: <span className="font-bold">{report.paid_leave_balance || 0}</span> / {report.total_paid_leaves_year || 0}</p>
                            </div>
                            <div>
                                <p className="font-medium">Sick Leave</p>
                                <p>Balance: <span className="font-bold">{report.sick_leave_balance || 0}</span> / {report.total_sick_leaves_year || 0}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="font-semibold mb-2">Salary Calculation for the Month</h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="font-medium text-gray-600">Base Salary</p><p className="font-bold text-lg">{formatCurrency(report.base_salary || 0)}</p>
                            </div>
                            <div>
                                <p className="font-medium text-red-600">Deductions (Unpaid)</p><p className="font-bold text-lg text-red-500">- {formatCurrency(report.deductions || 0)}</p>
                            </div>
                            <div>
                                <p className="font-medium text-green-600">Net Salary</p><p className="font-bold text-xl text-green-700">{formatCurrency(report.net_salary || 0)}</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

const StatusOverview = () => {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/employees/status-overview')
            .then(res => setOverview(res.data))
            .catch(err => console.error("Failed to fetch status overview", err))
            .finally(() => setLoading(false));
    }, []);

    const EmployeeList = ({ title, employees, colorClass }) => (
        <div className={`p-4 rounded-lg shadow-sm ${colorClass}`}>
            <h4 className="font-bold text-lg mb-2">{title} ({employees.length})</h4>
            {employees.length > 0 ? (
                <ul className="space-y-1 text-sm max-h-60 overflow-y-auto">
                    {employees.map(emp => (
                        <li key={emp.id} className="flex justify-between items-center p-1.5 rounded hover:bg-white/50">
                            <span>{emp.name}</span>
                            <span className="text-xs text-gray-600">{emp.role}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-gray-500 italic">No employees in this category.</p>
            )}
        </div>
    );

    if (loading) return <p>Loading employee overview...</p>;
    if (!overview) return <p>Could not load data.</p>;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
                <EmployeeList title="Active Employees" employees={overview.active_employees} colorClass="bg-green-50 text-green-900" />
                <EmployeeList title="On Paid Leave" employees={overview.on_paid_leave} colorClass="bg-blue-50 text-blue-900" />
                <EmployeeList title="On Sick Leave" employees={overview.on_sick_leave} colorClass="bg-yellow-50 text-yellow-900" />
                <EmployeeList title="On Unpaid Leave" employees={overview.on_unpaid_leave} colorClass="bg-orange-50 text-orange-900" />
                <EmployeeList title="Inactive Employees" employees={overview.inactive_employees} colorClass="bg-red-50 text-red-900" />
            </motion.div>
        </AnimatePresence>
    );
};

const EmployeeListAndForm = () => {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({ name: "", role: "", salary: "", join_date: "", email: "", phone: "", password: "", image: null });
  const [previewImage, setPreviewImage] = useState(null);
  const [editId, setEditId] = useState(null);
  const [salaryFilter, setSalaryFilter] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hoveredKPI, setHoveredKPI] = useState(null);

  const mediaBaseUrl = useMemo(() => getMediaBaseUrl(), []);

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, []);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

  const fetchEmployees = async () => {
    try {
      // Fetch both users and employees to show all users including admins
      const [usersRes, employeesRes] = await Promise.all([
        api.get("/users/?skip=0&limit=20", authHeader()),
        api.get("/employees?skip=0&limit=20", authHeader())
      ]);
      
      const users = usersRes.data || [];
      const employees = employeesRes.data || [];
      
      // Create a map of employees by user_id for quick lookup
      const employeeMap = new Map();
      employees.forEach(emp => {
        if (emp.user_id) {
          employeeMap.set(emp.user_id, emp);
        }
      });
      
      // Combine users with their employee data
      const combinedUsers = users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name || 'Unknown',
        phone: user.phone,
        is_active: user.is_active,
        // Add employee-specific data if available
        salary: employeeMap.get(user.id)?.salary || null,
        join_date: employeeMap.get(user.id)?.join_date || null,
        image_url: employeeMap.get(user.id)?.image_url || null,
        has_employee_record: employeeMap.has(user.id),
        trend: Array.from({ length: 30 }, () => Math.floor(Math.random() * 10000))
      }));
      
      setEmployees(combinedUsers);
      setHasMore(combinedUsers.length >= 20);
      setPage(1);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("/roles?limit=1000", authHeader());
      setRoles(res.data);
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image") {
      const file = files[0];
      setForm({ ...form, image: file });
      setPreviewImage(URL.createObjectURL(file));
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) {
      // For edit, password is optional
      const requiredFields = ["name", "role", "salary", "join_date", "email"];
      for (const field of requiredFields) {
        if (!form[field]) {
          alert(`Please fill in the required field: ${field}`);
          return;
        }
      }
    } else {
      // For create, password is required
      const requiredFields = ["name", "role", "salary", "join_date", "email", "password"];
      for (const field of requiredFields) {
        if (!form[field]) {
          alert(`Please fill in the required field: ${field}`);
          return;
        }
      }
    }
    const data = new FormData();
    data.append("name", form.name);
    data.append("role", form.role);
    data.append("salary", form.salary);
    data.append("join_date", form.join_date);
    data.append("email", form.email);
    if (editId) {
      // Only append password if it's provided (for edit)
      if (form.password && form.password.trim()) {
        data.append("password", form.password);
      }
      // Append is_active status if it exists
      if (form.is_active !== undefined) {
        data.append("is_active", String(form.is_active)); // Convert to string for FormData
      }
    } else {
      // For create, password is required
      data.append("password", form.password);
    }
    if (form.phone) data.append("phone", form.phone);
    if (form.image) data.append("image", form.image);

    try {
      if (editId) {
        await api.put(`/employees/${editId}`, data, authHeader());
      } else {
        await api.post("/employees", data, authHeader());
      }
      fetchEmployees();
      fetchUsers(); // Refresh users list
      resetForm();
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "An error occurred while saving the employee.";
      console.error("Error saving employee:", err.response || err);
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setForm({ name: "", role: "", salary: "", join_date: "", email: "", phone: "", password: "", is_active: true, image: null });
    setPreviewImage(null);
    setEditId(null);
  };

  const handleEdit = (emp) => {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      role: emp.role,
      salary: emp.salary,
      join_date: emp.join_date ? emp.join_date.split("T")[0] : "",
      email: emp.email,
      phone: emp.phone,
      password: "", // Leave empty for edit - only update if provided
      is_active: emp.is_active !== undefined ? emp.is_active : true,
      image: null,
    });
    // Build full URL for the preview image
    if (emp.image_url) {
      const imagePath = emp.image_url.startsWith('/') ? emp.image_url.substring(1) : emp.image_url;
      setPreviewImage(`${mediaBaseUrl}/${imagePath}`);
    } else {
      setPreviewImage(null);
    }
  };

  const handleToggleActive = async (emp) => {
    if (!window.confirm(`Are you sure you want to ${emp.is_active ? 'deactivate' : 'activate'} this employee?`)) {
      return;
    }
    try {
      const data = new FormData();
      data.append("is_active", String(!emp.is_active)); // Convert to string for FormData
      await api.put(`/employees/${emp.id}`, data, authHeader());
      fetchEmployees();
      fetchUsers(); // Refresh users list
    } catch (err) {
      const errorMessage = err.response?.data?.detail || "An error occurred while updating employee status.";
      console.error("Error updating employee:", err.response || err);
      alert(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this employee?")) {
      await api.delete(`/employees/${id}`, authHeader());
      fetchEmployees();
    }
  };

  const loadMoreEmployees = async () => {
    if (isFetchingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsFetchingMore(true);
    try {
      const res = await api.get(`/employees?skip=${(nextPage - 1) * 20}&limit=20`, authHeader());
      const newEmployees = res.data || [];
      const dataWithTrend = newEmployees.map((emp) => ({ ...emp, trend: Array.from({ length: 30 }, () => Math.floor(Math.random() * 10000)) }));
      setEmployees(prev => [...prev, ...dataWithTrend]);
      setPage(nextPage);
      setHasMore(newEmployees.length >= 20);
    } catch (err) {
      console.error("Failed to load more employees:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const filteredEmployees = employees.filter((emp) => salaryFilter ? emp.salary >= parseFloat(salaryFilter) : true);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredEmployees);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "employees.xlsx");
  };

  const totalEmployees = employees.length;
  const avgSalary = employees.length > 0 ? Math.round(employees.reduce((acc, e) => acc + e.salary, 0) / employees.length) : 0;
  const rolesCount = roles.map((r) => ({ name: r.name, count: employees.filter((e) => e.role === r.name).length, trend: Array.from({ length: 30 }, () => Math.floor(Math.random() * 10000)) }));
  const kpiData = [{ label: "Total Employees", value: totalEmployees, color: "#4f46e5", trend: employees.map(e => e.salary) }, { label: "Avg Salary", value: avgSalary, color: "#16a34a", trend: employees.map(e => e.salary) }, ...rolesCount.map(r => ({ label: r.name, value: r.count, color: "#f59e0b", trend: r.trend }))];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, idx) => (
          <div key={idx} className="relative bg-white p-5 rounded-xl shadow cursor-pointer hover:shadow-xl transition" onMouseEnter={() => setHoveredKPI(idx)} onMouseLeave={() => setHoveredKPI(null)}>
            <div className="flex flex-col items-center">
              <span className="text-gray-500">{kpi.label}</span>
              <span className="text-2xl font-bold" style={{ color: kpi.color }}><CountUp end={kpi.value} duration={1.5} /></span>
            </div>
            {hoveredKPI === idx && (
              <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center rounded-xl p-2 shadow-lg">
                <ResponsiveContainer width="100%" height={50}>
                  <LineChart data={kpi.trend.map((v, i) => ({ day: i + 1, value: v }))}>
                    <Line type="monotone" dataKey="value" stroke={kpi.color} strokeWidth={2} dot={false} />
                    <Tooltip contentStyle={{ fontSize: 12 }} formatter={(val) => [`₹${val}`, "Salary"]} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow mb-8 max-w-4xl mx-auto flex gap-6" encType="multipart/form-data">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">{editId ? "Edit" : "Create"} Employee</h2>
          <div className="grid grid-cols-1 gap-4">
            <label className="text-sm text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handleFormChange} placeholder="Name" className="border px-3 py-2 rounded w-full" required />
            <label className="text-sm text-gray-600 mb-1">Role <span className="text-red-500">*</span></label>
            <select name="role" value={form.role} onChange={handleFormChange} className="border px-3 py-2 rounded w-full" required>
              <option value="">Select Role</option>
              {roles.map((role) => (<option key={role.id} value={role.name}>{role.name}</option>))}
            </select>
            <label className="text-sm text-gray-600 mb-1">Salary <span className="text-red-500">*</span></label>
            <input name="salary" type="number" value={form.salary} onChange={handleFormChange} placeholder="Salary" className="border px-3 py-2 rounded w-full" required />
            <label className="text-sm text-gray-600 mb-1">Joining Date <span className="text-red-500">*</span></label>
            <input type="date" name="join_date" value={form.join_date} onChange={handleFormChange} className="border px-3 py-2 rounded w-full" required />
            <label className="text-sm text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
            <input name="email" type="email" value={form.email} onChange={handleFormChange} placeholder="Email" className="border px-3 py-2 rounded w-full" required />
            <label className="text-sm text-gray-600 mb-1">Phone</label>
            <input name="phone" type="tel" value={form.phone} onChange={handleFormChange} placeholder="Phone (optional)" className="border px-3 py-2 rounded w-full" />
            <label className="text-sm text-gray-600 mb-1">
              Password {editId ? "(Leave blank to keep current)" : <span className="text-red-500">*</span>}
            </label>
            <input name="password" type="password" value={form.password} onChange={handleFormChange} placeholder={editId ? "New password (optional)" : "Password"} className="border px-3 py-2 rounded w-full" required={!editId} />
            {editId && (
              <>
                <label className="text-sm text-gray-600 mb-1">Status</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    name="is_active" 
                    checked={form.is_active !== undefined ? form.is_active : true} 
                    onChange={(e) => setForm({...form, is_active: e.target.checked})}
                    className="w-5 h-5"
                  />
                  <span className="text-sm">{form.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </>
            )}
            <label className="text-sm text-gray-600 mb-1">Image</label>
            <input type="file" name="image" accept="image/*" onChange={handleFormChange} className="w-full" />
            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">{editId ? "Update" : "Create"}</button>
          </div>
        </div>
        <div className="flex items-center justify-center w-48 h-48 border rounded">
          {previewImage ? <img src={previewImage} alt="Preview" className="w-full h-full object-cover rounded" /> : <span className="text-gray-400">Image Preview</span>}
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-4 justify-between items-center">
        <input type="number" placeholder="Min Salary" value={salaryFilter} onChange={(e) => setSalaryFilter(e.target.value)} className="border px-3 py-2 rounded" />
        <button onClick={exportToExcel} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export to Excel</button>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">#</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Image</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Name</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Role</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Salary</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Join Date</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Status</th>
              <th className="p-2 sm:p-3 border text-xs sm:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp, i) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="p-1 sm:p-2 border text-center text-xs sm:text-sm">{i + 1}</td>
                <td className="p-1 sm:p-2 border">
                  {emp.image_url ? (
                    <img 
                      src={`${mediaBaseUrl}/${emp.image_url.startsWith('/') ? emp.image_url.substring(1) : emp.image_url}`} 
                      alt="Profile" 
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover" 
                    />
                  ) : (
                    <span className="text-gray-400 text-xs sm:text-sm">No image</span>
                  )}
                </td>
                <td className="p-1 sm:p-2 border text-xs sm:text-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center">
                    <span className="truncate">{emp.name}</span>
                    {!emp.has_employee_record && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-1 sm:px-2 py-0.5 sm:py-1 rounded mt-1 sm:mt-0 sm:ml-2">Admin</span>
                    )}
                  </div>
                </td>
                <td className="p-1 sm:p-2 border text-xs sm:text-sm">{emp.role}</td>
                <td className="p-1 sm:p-2 border text-right text-xs sm:text-sm">{emp.salary ? `₹${emp.salary}` : 'N/A'}</td>
                <td className="p-1 sm:p-2 border text-xs sm:text-sm">{emp.join_date || 'N/A'}</td>
                <td className="p-1 sm:p-2 border text-xs sm:text-sm">
                  {emp.has_employee_record ? (
                    <span className={`px-2 py-1 rounded text-xs ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">-</span>
                  )}
                </td>
                <td className="p-1 sm:p-2 border">
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    {emp.has_employee_record ? (
                      <>
                        <button 
                          className="bg-blue-500 text-white px-1 sm:px-2 py-1 text-xs sm:text-sm rounded" 
                          onClick={() => handleEdit(emp)}
                        >
                          Edit
                        </button>
                        <button 
                          className={`px-1 sm:px-2 py-1 text-xs sm:text-sm rounded ${emp.is_active ? 'bg-yellow-500' : 'bg-green-500'} text-white`}
                          onClick={() => handleToggleActive(emp)}
                        >
                          {emp.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          className="bg-red-500 text-white px-1 sm:px-2 py-1 text-xs sm:text-sm rounded" 
                          onClick={() => handleDelete(emp.id)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500 text-xs sm:text-sm">Admin User</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center py-4 text-gray-500 text-sm sm:text-base">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
          {hasMore && filteredEmployees.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="8" className="text-center p-4">
                  <button onClick={loadMoreEmployees} disabled={isFetchingMore} className="bg-indigo-100 text-indigo-700 font-semibold px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:bg-gray-200 disabled:text-gray-500">
                    {isFetchingMore ? "Loading..." : "Load More"}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

const EmployeeManagement = () => {
    const [activeTab, setActiveTab] = useState('attendance');

    const renderContent = () => {
        switch (activeTab) {
            case 'manage-employees': return <EmployeeListAndForm />;
            case 'report': return <UserHistory />;
            case 'leave': return <LeaveManagement />;
            case 'attendance': return <AttendanceTracking />;
            case 'monthly-report': return <MonthlyReport />;
            case 'status-overview': return <StatusOverview />;
            default: return null;
        }
    };

    const TabButton = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
            {icon}
            {label}
        </button>
    );

    return (
        <DashboardLayout>
            <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
                <h1 className="text-3xl font-bold text-gray-800">Employee Management</h1>

                <div className="bg-white p-4 rounded-xl shadow-md">
                    <div className="flex flex-wrap gap-2 border-b mb-4 pb-2">
                        <TabButton id="manage-employees" label="Manage Employees" icon={<Users size={16} />} />
                        <TabButton id="report" label="Activity Report" icon={<Briefcase size={16} />} />
                        <TabButton id="leave" label="Leave Requests" icon={<UserCheck size={16} />} />
                        <TabButton id="attendance" label="Attendance & Hours" icon={<Clock size={16} />} />
                        <TabButton id="monthly-report" label="Monthly Report" icon={<Calendar size={16} />} />
                        <TabButton id="status-overview" label="Status Overview" icon={<Briefcase size={16} />} />
                    </div>

                    <div className="p-4">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default EmployeeManagement;