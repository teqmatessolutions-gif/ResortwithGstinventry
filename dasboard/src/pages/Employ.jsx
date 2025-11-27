// Employ.jsx

import React, { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import API from "../services/api";
import * as XLSX from "xlsx";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";
import CountUp from "react-countup";

const Employee = () => {
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    name: "",
    role: "",
    salary: "",
    join_date: "",
    email: "", 
    phone: "", 
    password: "", 
    image: null,
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [editId, setEditId] = useState(null);
  const [salaryFilter, setSalaryFilter] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hoveredKPI, setHoveredKPI] = useState(null);

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, []);

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const fetchEmployees = async () => {
    try {
      const res = await API.get("/employees?skip=0&limit=20", authHeader());
      // Add random last 30 days salary trend for KPI hover charts
      const dataWithTrend = res.data.map((emp) => ({
        ...emp,
        trend: Array.from({ length: 30 }, () => Math.floor(Math.random() * 10000)),
      }));
      setEmployees(dataWithTrend);
      setHasMore(res.data.length >= 20);
      setPage(1);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await API.get("/roles?limit=1000", authHeader()); // Fetch all roles for the dropdown
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

    // Basic validation check for required fields
    const requiredFields = ["name", "role", "salary", "join_date", "email", "password"];
    for (const field of requiredFields) {
      if (!form[field]) {
        alert(`Please fill in the required field: ${field}`);
        return; 
      }
    }
    
    // ✅ Rebuild the FormData object explicitly
    const data = new FormData();
    data.append("name", form.name);
    data.append("role", form.role);
    data.append("salary", form.salary);
    data.append("join_date", form.join_date);
    data.append("email", form.email);
    data.append("password", form.password);

    // ✅ Add phone and image fields if they exist
    if (form.phone) {
        data.append("phone", form.phone);
    }

    if (form.image) {
      data.append("image", form.image);
    }

    try {
      if (editId) {
        await API.put(`/employees/${editId}`, data, authHeader());
      } else {
        await API.post("/employees", data, authHeader());
      }
      fetchEmployees();
      resetForm();
    } catch (err) {
      // More specific error handling
      const errorMessage = err.response?.data?.detail || "An error occurred while saving the employee.";
      console.error("Error saving employee:", err.response || err);
      // Use a more user-friendly alert or a state-based message display
      alert(errorMessage);
    }
  };

  const resetForm = () => {
    setForm({ 
      name: "", 
      role: "", 
      salary: "", 
      join_date: "", 
      email: "", 
      phone: "",
      password: "",
      image: null 
    });
    setPreviewImage(null);
    setEditId(null);
  };

  const handleEdit = (emp) => {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      role: emp.role,
      salary: emp.salary,
      join_date: emp.join_date.split("T")[0],
      email: emp.email, // ✅ Use email from the employee data
      phone: emp.phone, // ✅ Use phone from the employee data
      password: "", // ✅ Keep password as empty for security
      image: null,
    });
    setPreviewImage(emp.image_url || null);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this employee?")) {
      await API.delete(`/employees/${id}`, authHeader());
      fetchEmployees();
    }
  };

  const loadMoreEmployees = async () => {
    if (isFetchingMore || !hasMore) return;
    const nextPage = page + 1;
    setIsFetchingMore(true);
    try {
      const res = await API.get(`/employees?skip=${(nextPage - 1) * 20}&limit=20`, authHeader());
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

  const filteredEmployees = employees.filter((emp) =>
    salaryFilter ? emp.salary >= parseFloat(salaryFilter) : true
  );

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredEmployees);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "employees.xlsx");
  };

  const totalEmployees = employees.length;
  const avgSalary =
    employees.length > 0
      ? Math.round(employees.reduce((acc, e) => acc + e.salary, 0) / employees.length)
      : 0;
  const rolesCount = roles.map((r) => ({
    name: r.name,
    count: employees.filter((e) => e.role === r.name).length,
    trend: Array.from({ length: 30 }, () => Math.floor(Math.random() * 10000)),
  }));

  const kpiData = [
    { label: "Total Employees", value: totalEmployees, color: "#4f46e5", trend: employees.map(e => e.salary) },
    { label: "Avg Salary", value: avgSalary, color: "#16a34a", trend: employees.map(e => e.salary) },
    ...rolesCount.map(r => ({ label: r.name, value: r.count, color: "#f59e0b", trend: r.trend }))
  ];

  return (
    <DashboardLayout>
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Employee Management</h1>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, idx) => (
          <div
            key={idx}
            className="relative bg-white p-5 rounded-xl shadow cursor-pointer hover:shadow-xl transition"
            onMouseEnter={() => setHoveredKPI(idx)}
            onMouseLeave={() => setHoveredKPI(null)}
          >
            <div className="flex flex-col items-center">
              <span className="text-gray-500">{kpi.label}</span>
              <span className="text-2xl font-bold" style={{ color: kpi.color }}>
                <CountUp end={kpi.value} duration={1.5} />
              </span>
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

      {/* Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow mb-8 max-w-4xl mx-auto flex gap-6"
        encType="multipart/form-data"
      >
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">{editId ? "Edit" : "Create"} Employee</h2>
          <div className="grid grid-cols-1 gap-4">
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Name <span className="text-red-500">*</span>
  </label>
            <input
              name="name"
              value={form.name}
              onChange={handleFormChange}
              placeholder="Name"
              className="border px-3 py-2 rounded w-full"
              required
            />
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
   Role <span className="text-red-500">*</span>
  </label>
            <select
              name="role"
              value={form.role}
              onChange={handleFormChange}
              className="border px-3 py-2 rounded w-full"
              required
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Salary <span className="text-red-500">*</span>
  </label>
            <input
              name="salary"
              type="number"
              value={form.salary}
              onChange={handleFormChange}
              placeholder="Salary"
              className="border px-3 py-2 rounded w-full"
              required

            />
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Joining Date <span className="text-red-500">*</span>
  </label>
            <input
              type="date"
              name="join_date"
              value={form.join_date}
              onChange={handleFormChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Email <span className="text-red-500">*</span>
  </label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleFormChange}
              placeholder="Email"
              className="border px-3 py-2 rounded w-full"
              required
            />
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Phone <span className="text-red-500">*</span>
  </label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleFormChange}
              placeholder="Phone (optional)"
              className="border px-3 py-2 rounded w-full"
            />
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Password <span className="text-red-500">*</span>
  </label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleFormChange}
              placeholder="Password"
              className="border px-3 py-2 rounded w-full"
              required
            />
            <label htmlFor="join_date" className="text-sm text-gray-600 mb-1">
    Image <span className="text-red-500">*</span>
  </label>
            <input
              type="file"
              name="image"
              accept="image/*"
              onChange={handleFormChange}
              className="w-full"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            >
              {editId ? "Update" : "Create"}
            </button>
          </div>
        </div>
        <div className="flex items-center justify-center w-48 h-48 border rounded">
          {previewImage ? (
            <img src={previewImage} alt="Preview" className="w-full h-full object-cover rounded" />
          ) : (
            <span className="text-gray-400">Image Preview</span>
          )}
        </div>
      </form>

      {/* Filters and Export */}
      <div className="mb-4 flex flex-wrap gap-4 justify-between items-center">
        <input
          type="number"
          placeholder="Min Salary"
          value={salaryFilter}
          onChange={(e) => setSalaryFilter(e.target.value)}
          className="border px-3 py-2 rounded"
        />
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Export to Excel
        </button>
      </div>

      {/* Employee Table */}
      <div className="bg-white p-6 rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-3 border">#</th>
              <th className="p-3 border">Image</th>
              <th className="p-3 border">Name</th>
              <th className="p-3 border">Role</th>
              <th className="p-3 border">Salary</th>
              <th className="p-3 border">Join Date</th>
              <th className="p-3 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp, i) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="p-2 border text-center">{i + 1}</td>
                <td className="p-2 border">
                  {emp.image_url ? (
                    <img src={`http://localhost:8000/${emp.image_url}`} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-gray-400">No image</span>
                  )}
                </td>
                <td className="p-2 border">{emp.name}</td>
                <td className="p-2 border">{emp.role}</td>
                <td className="p-2 border text-right">₹{emp.salary}</td>
                <td className="p-2 border">{emp.join_date}</td>
                <td className="p-2 border">
                  <div className="flex gap-2">
                    <button className="bg-blue-500 text-white px-2 py-1 rounded" onClick={() => handleEdit(emp)}>Edit</button>
                    <button className="bg-red-500 text-white px-2 py-1 rounded" onClick={() => handleDelete(emp.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-4 text-gray-500">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>          
          {hasMore && filteredEmployees.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="7" className="text-center p-4">
                  <button
                    onClick={loadMoreEmployees}
                    disabled={isFetchingMore}
                    className="bg-indigo-100 text-indigo-700 font-semibold px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:bg-gray-200 disabled:text-gray-500"
                  >
                    {isFetchingMore ? "Loading..." : "Load More"}
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </DashboardLayout>
  );
};

export default Employee;