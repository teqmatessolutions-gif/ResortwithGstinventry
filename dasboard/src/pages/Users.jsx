import React, { useState, useEffect } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import API from "../services/api";
import BannerMessage from "../components/BannerMessage";

const Users = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [message, setMessage] = useState("");
  const [bannerMessage, setBannerMessage] = useState({ type: null, text: "" });
  const [hasMore, setHasMore] = useState(true);

  // Function to show banner message
  const showBannerMessage = (type, text) => {
    setBannerMessage({ type, text });
  };

  const closeBannerMessage = () => {
    setBannerMessage({ type: null, text: "" });
  };
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role_id: "",
  });
const handleView = (user) => {
  setSelectedUser(user);
  setShowViewModal(true);
};

const handleEdit = (user) => {
  setSelectedUser(user);
  setForm({
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    password: "",
    role_id: user.role?.id || "",
  });
  setShowEditModal(true);
};

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await API.get("/users?skip=0&limit=20", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setUsers(res.data);
      setHasMore(res.data.length === 10);
      setPage(1);
    } catch (err) {
      console.error("Error fetching users:", err);
      showBannerMessage("error", "Failed to load users.");
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await API.get("/roles", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      setRoles(res.data);
    } catch (err) {
      console.error("Error fetching roles:", err);
      showBannerMessage("error", "Failed to load roles.");
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/users", form, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      showBannerMessage("success", "User created successfully!");
      setForm({ name: "", email: "", password: "", phone: "", role_id: "" });
      fetchUsers();
    } catch (err) {
      console.error("Create user error:", err);
      showBannerMessage("error", "Failed to create user.");
    }
  };

  const loadMoreUsers = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    try {
      const res = await API.get(`/users?skip=${(nextPage - 1) * 20}&limit=20`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const newUsers = res.data || [];
      setUsers(prev => [...prev, ...newUsers]);
      setPage(nextPage);
      setHasMore(newUsers.length === 10);
    } catch (err) {
      console.error("Failed to load more users:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  return (
    <DashboardLayout>
      <BannerMessage 
        message={bannerMessage} 
        onClose={closeBannerMessage}
        autoDismiss={true}
        duration={5000}
      />
      {showViewModal && selectedUser && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-[400px]">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">User Details</h2>
      
      <div className="space-y-2 text-gray-700 text-sm">
        <p><strong>Name:</strong> {selectedUser.name}</p>
        <p><strong>Email:</strong> {selectedUser.email}</p>
        <p><strong>Phone:</strong> {selectedUser.phone || "-"}</p>
        <p><strong>Role:</strong> {selectedUser.role?.name}</p>
        <p><strong>Status:</strong> 
          <span className={`ml-1 font-medium ${selectedUser.is_active ? "text-green-600" : "text-red-600"}`}>
            {selectedUser.is_active ? "Active" : "Inactive"}
          </span>
        </p>
      </div>

      <div className="mt-6 text-right">
        <button
          onClick={() => setShowViewModal(false)}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

      <div className="p-6 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4">Users</h1>

        {/* Create User Form */}
        <form
          onSubmit={handleCreateUser}
          className="mb-6 space-y-4 bg-gray-50 p-4 rounded shadow-sm"
        >
          <h2 className="text-xl font-semibold">➕ Create New User</h2>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={form.name}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            />
            <input
              type="text"
              name="phone"
              placeholder="Phone"
              value={form.phone}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
            />
            <select
              name="role_id"
              value={form.role_id}
              onChange={handleChange}
              className="border px-3 py-2 rounded w-full"
              required
            >
              <option value="">Select Role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Create User
          </button>
        </form>

        {/* Users Table */}
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">#</th>
              <th className="p-2 border">Username</th>
              <th className="p-2 border">Email</th>
              <th className="p-2 border">Role</th>
              <th className="p-2 border">Phone</th>
              <th className="p-2 border">Status</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id}>
                <td className="p-2 border text-center">{index + 1}</td>
                <td className="p-2 border">{user.name}</td>
                <td className="p-2 border">{user.email}</td>
                <td className="p-2 border">{user.role?.name || "-"}</td>
                <td className="p-2 border">{user.phone || "-"}</td>
                <td className="p-2 border text-center">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {user.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-2 border text-center">
                  <div className="flex gap-2 justify-center">
                   <button onClick={() => handleView(user)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm">View</button>
                    <button onClick={() => handleEdit(user)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm">Edit</button>

                    
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="7" className="text-center py-4 text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {hasMore && (
          <div className="text-center mt-4">
            <button
              onClick={loadMoreUsers}
              disabled={isFetchingMore}
              className="bg-indigo-100 text-indigo-700 font-semibold px-6 py-2 rounded-lg hover:bg-indigo-200 transition-colors disabled:bg-gray-200 disabled:text-gray-500"
            >
              {isFetchingMore ? "Loading..." : "Load More Users"}
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Users;
