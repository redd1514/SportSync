import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Shield, X, Check, Eye, EyeOff } from "lucide-react";
import { useUser, StaffAccount } from "../../contexts/UserContext";
import { SectionLoader } from "../shared/LoadingScreen";

const MODULES = [
  "Dashboard",
  "Booking Management",
  "Court Status",
  "Coaching Requests",
  "User Account Management",
  "Announcements"
];

export function RoleManagementAdmin() {
  const { staffAccounts, addStaff, updateStaff } = useUser();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    role: "staff" as "staff" | "admin",
    status: "active" as "active" | "inactive",
    permissions: [...MODULES]
  });

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      email: "",
      username: "",
      password: "",
      role: "staff",
      status: "active",
      permissions: [...MODULES]
    });
    setIsModalOpen(true);
  };

  const openEditModal = (staff: StaffAccount) => {
    setEditingId(staff.id);
    setFormData({
      name: staff.name,
      email: staff.email,
      username: staff.username,
      password: staff.password || "",
      role: staff.role,
      status: staff.status,
      permissions: staff.permissions || [...MODULES]
    });
    setIsModalOpen(true);
  };

  const toggleStatus = (staff: StaffAccount) => {
    updateStaff(staff.id, { status: staff.status === "active" ? "inactive" : "active" });
  };

  const handleTogglePermission = (mod: string) => {
    setFormData(prev => {
      const perms = prev.permissions.includes(mod)
        ? prev.permissions.filter(p => p !== mod)
        : [...prev.permissions, mod];
      return { ...prev, permissions: perms };
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.username) return;
    
    if (editingId) {
      updateStaff(editingId, formData);
    } else {
      addStaff({
        id: `STAFF${Date.now()}`,
        ...formData
      });
    }
    setIsModalOpen(false);
  };

  useEffect(() => {
    const t = setTimeout(() => setIsInitialLoad(false), 600);
    return () => clearTimeout(t);
  }, []);

  if (isInitialLoad) {
    return (
      <div className="flex flex-col h-full items-center justify-center min-h-[400px] bg-[#131314]">
        <SectionLoader label="Loading role management…" accentColor="#F97316" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#1A1A1A] p-6 rounded-2xl border border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
            <Shield className="w-6 h-6 text-[#FF8C00]" />
            Staff Roles & Access Management
          </h2>
          <p className="text-gray-400">Manage staff accounts and permissions</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-[#FF8C00] hover:bg-[#e67e00] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" /> Create Staff Account
        </button>
      </div>

      <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-gray-400 text-sm font-semibold uppercase">
                <th className="p-4">Name</th>
                <th className="p-4">Email / Username</th>
                <th className="p-4">Role</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffAccounts.map(staff => (
                <tr key={staff.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{staff.name}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-300">{staff.email}</div>
                    <div className="text-xs text-gray-500">@{staff.username}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-[#0047AB]/20 text-[#0047AB] rounded-full text-xs font-bold capitalize">
                      {staff.role} Admin
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      staff.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {staff.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(staff)}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                        title="Edit Account"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleStatus(staff)}
                        className={`p-2 rounded-lg transition-colors ${
                          staff.status === "active" 
                            ? "hover:bg-red-500/20 text-gray-400 hover:text-red-400" 
                            : "hover:bg-green-500/20 text-gray-400 hover:text-green-400"
                        }`}
                        title={staff.status === "active" ? "Deactivate" : "Activate"}
                      >
                        {staff.status === "active" ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {staffAccounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No staff accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1A1A1A] w-full max-w-xl rounded-3xl border border-white/10 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-white/5 flex justify-between items-center flex-shrink-0">
              <h3 className="text-xl font-black text-white">
                {editingId ? "Edit Staff Account" : "Create Staff Account"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-400">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FF8C00]"
                    placeholder="e.g. Juan Staff"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-400">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FF8C00]"
                    placeholder="staff@jrc.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-400">Username</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({...formData, username: e.target.value})}
                    className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FF8C00]"
                    placeholder="jstaff"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-400">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FF8C00] pr-10"
                      placeholder="Enter password"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-400">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as "staff" | "admin"})}
                  className="w-full bg-[#0D0D0D] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#FF8C00]"
                >
                  <option value="staff">Staff Admin (Limited Access)</option>
                  <option value="admin">Super Admin (Full Access)</option>
                </select>
              </div>

              {formData.role === "staff" && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-400">Module Access</label>
                  <div className="grid grid-cols-2 gap-3">
                    {MODULES.map(mod => (
                      <label key={mod} className="flex items-center gap-3 p-3 rounded-xl bg-[#0D0D0D] border border-white/5 cursor-pointer hover:border-white/20 transition-colors">
                        <input 
                          type="checkbox"
                          checked={formData.permissions.includes(mod)}
                          onChange={() => handleTogglePermission(mod)}
                          className="w-4 h-4 rounded text-[#FF8C00] bg-black border-white/20 focus:ring-[#FF8C00]"
                        />
                        <span className="text-sm text-gray-300">{mod}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 flex gap-4 flex-shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.email || !formData.username}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-[#FF8C00] hover:bg-[#e67e00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
