// src/pages/RoleForm.jsx
import React, { useState, useEffect } from "react";
import API from "../services/api";
import DashboardLayout from "../layout/DashboardLayout";
import { Trash2, CheckCircle, XCircle, Edit } from "lucide-react";

const availablePermissions = [
    { label: "Dashboard", value: "/dashboard" },
    { label: "Account", value: "/account" },
    { label: "Bookings", value: "/bookings" },
    { label: "Rooms", value: "/rooms" },
    { label: "Services", value: "/services" },
    { label: "Food Orders", value: "/food-orders" },
    { label: "Employee", value: "/employee" },
    { label: "Role", value: "/roles" },
    { label: "Expenses", value: "/expenses" },
    { label: "Food Management", value: "/food-categories" },
    { label: "Billing", value: "/billing" },
    { label: "WEB Management", value: "/Userfrontend_data" },
    { label: "Packages", value: "/package" },
    { label: "Reports", value: "/report" },
    { label: "GuestProfiles", value: "/guestprofiles" },
];

// Define roles that cannot be deleted from the UI
const PROTECTED_ROLES = ['admin'];

const RoleForm = () => {
  const [form, setForm] = useState({ name: "", permissions: [] });
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editRoleId, setEditRoleId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);

  const fetchRoles = async () => {
    try {
      const response = await API.get("/roles");
      setRoles(response.data);
    } catch (err) {
      console.error("Failed to fetch roles", err);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value.trimStart() }));
  };

  const handlePermissionChange = (permissionValue) => {
    setForm((prev) => {
      const newPermissions = prev.permissions.includes(permissionValue)
        ? prev.permissions.filter((p) => p !== permissionValue)
        : [...prev.permissions, permissionValue];
      return { ...prev, permissions: newPermissions };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // The backend expects permissions as a JSON string, not a direct array.
      const payload = {
        ...form,
        permissions: JSON.stringify(form.permissions),
      };
      if (editRoleId) {
        await API.put(`/roles/${editRoleId}`, payload);
        setSuccess("Role updated successfully!");
      } else {
        await API.post("/roles", payload);
        setSuccess("Role created successfully!");
      }
      setForm({ name: "", permissions: [] });
      setEditRoleId(null);
      await fetchRoles();
    } catch (err) {
      if (editRoleId && err.response && err.response.status === 404) {
        setError("Failed to update role. It may have been deleted by another user.");
        // Exit edit mode and refresh the list as the role is gone
        setEditRoleId(null);
        setForm({ name: "", permissions: [] });
        await fetchRoles();
      } else {
        setError(editRoleId ? "Failed to update role" : "Failed to create role");
      }
    }
    setLoading(false);
  };

  const handleEditClick = (role) => {
    setEditRoleId(role.id);
    setForm({
      name: role.name,
      permissions: role.permissions || [],
    });
    setSuccess("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditRoleId(null);
    setForm({ name: "", permissions: [] });
    setSuccess("");
    setError("");
  };

  const handleDeleteClick = (role) => {
    setRoleToDelete(role);
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setShowConfirm(false);
    try {
      await API.delete(`/roles/${roleToDelete.id}`);
      await fetchRoles();
      setSuccess("Role deleted successfully!");
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError("Failed to delete role. It may have already been deleted.");
      } else {
        setError("Failed to delete role. Please try again.");
      }
    } finally {
      setLoading(false);
      setRoleToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setRoleToDelete(null);
    setShowConfirm(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-8 bg-gray-50 rounded-2xl shadow-lg space-y-10">
        <h2 className="text-4xl font-extrabold text-blue-900 text-center tracking-tight">Role Management</h2>
        
        {/* Alerts for Success/Error */}
        {success && (
          <div className="flex items-center gap-2 p-4 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
            <CheckCircle size={20} />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-4 text-sm font-medium text-red-700 bg-red-100 rounded-lg">
            <XCircle size={20} />
            {error}
          </div>
        )}

        {/* Role Creation Form */}
        <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
          <h3 className="text-2xl font-semibold text-blue-800 border-b pb-4">{editRoleId ? "Edit Role" : "Create New Role"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="roleName" className="block text-sm font-semibold text-gray-700 mb-1">
                Role Name
              </label>
              <input
                id="roleName"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g., Administrator, Manager, Staff"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Permissions</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-gray-50">
                {availablePermissions.map((permission) => (
                  <label key={permission.value} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.permissions.includes(permission.value)}
                      onChange={() => handlePermissionChange(permission.value)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    {permission.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : (editRoleId ? "Update Role" : "Create Role")}
              </button>
              {editRoleId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg shadow-lg transition-transform transform hover:scale-105"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        
        {/* Existing Roles Table */}
        <div className="space-y-4 bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-2xl font-semibold text-blue-800 border-b pb-4">Existing Roles</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-700 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">Role Name</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length > 0 ? (
                  roles.map((role) => {
                    const isProtected = PROTECTED_ROLES.includes(role.name.toLowerCase());
                    return (
                      <tr key={role.id} className="border-t border-gray-200 hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 font-mono text-gray-500">{role.id}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{role.name}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditClick(role)}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="Edit Role"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(role)}
                              className={`transition-colors ${isProtected ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:text-red-800'}`}
                              title={isProtected ? "This role cannot be deleted" : "Delete Role"}
                              disabled={isProtected}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="2" className="text-center text-gray-400 py-6">
                      No roles found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Deletion */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-sm text-center space-y-4">
            <h4 className="text-lg font-bold text-gray-800">Confirm Deletion</h4>
            <p className="text-gray-600">
              Are you sure you want to delete the role "<span className="font-semibold">{roleToDelete?.name}</span>"? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={handleCancelDelete}
                className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default RoleForm;