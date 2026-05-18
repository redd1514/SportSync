import React, { useState, useEffect, useCallback } from "react";
import {
  Plus, Edit2, X, Check, Eye, EyeOff, LayoutDashboard, CalendarDays,
  Activity, GraduationCap, Users, Megaphone, ShieldCheck, UserCog,
  Mail, KeyRound, AtSign, BadgeCheck,
} from "lucide-react";
import { StaffAccount } from "../../contexts/UserContext";
import { SectionLoader } from "../shared/LoadingScreen";
import { useStaffAPI } from "../../hooks/useStaffAPI";

const MODULES = [
  "Dashboard",
  "Booking Management",
  "Court Status",
  "Coaching Requests",
  "User Account Management",
  "Announcements",
];

const MODULE_META: Record<string, { icon: any; color: string; desc: string }> = {
  Dashboard: { icon: LayoutDashboard, color: "#F97316", desc: "Live overview and KPIs" },
  "Booking Management": { icon: CalendarDays, color: "#38BDF8", desc: "Bookings, QR, and calendar work" },
  "Court Status": { icon: Activity, color: "#22C55E", desc: "Check-in, check-out, and court flow" },
  "Coaching Requests": { icon: GraduationCap, color: "#A855F7", desc: "Coach payments and requests" },
  "User Account Management": { icon: Users, color: "#FBBF24", desc: "Customer records and access" },
  Announcements: { icon: Megaphone, color: "#EC4899", desc: "Publish notices and alerts" },
};

function isStaffPayload(x: unknown): x is StaffAccount {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.email === "string" && typeof o.name === "string";
}

export function RoleManagementAdmin() {
  const { getStaffAccounts, createStaffAccount, updateStaffAccount } = useStaffAPI();
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [saving, setSaving] = useState(false);
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
    permissions: [...MODULES],
  });

  const loadStaff = useCallback(async () => {
    setLoadError(null);
    try {
      const rows = await getStaffAccounts();
      if (!Array.isArray(rows)) {
        setStaffList([]);
        return;
      }
      const mapped = rows.filter(isStaffPayload).map((r) => ({
        ...r,
        permissions: Array.isArray(r.permissions) && r.permissions.length ? r.permissions : [...MODULES],
      }));
      setStaffList(mapped);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load staff";
      setLoadError(msg);
      setStaffList([]);
    } finally {
      setIsInitialLoad(false);
    }
  }, [getStaffAccounts]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      email: "",
      username: "",
      password: "",
      role: "staff",
      status: "active",
      permissions: [...MODULES],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (staff: StaffAccount) => {
    setEditingId(staff.id);
    setFormData({
      name: staff.name,
      email: staff.email,
      username: staff.username,
      password: "",
      role: staff.role,
      status: staff.status,
      permissions: staff.permissions?.length ? [...staff.permissions] : [...MODULES],
    });
    setIsModalOpen(true);
  };

  const toggleStatus = async (staff: StaffAccount) => {
    setLoadError(null);
    try {
      const next = staff.status === "active" ? "inactive" : "active";
      await updateStaffAccount(staff.id, { status: next });
      await loadStaff();
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleTogglePermission = (mod: string) => {
    setFormData((prev) => {
      const perms = prev.permissions.includes(mod)
        ? prev.permissions.filter((p) => p !== mod)
        : [...prev.permissions, mod];
      return { ...prev, permissions: perms };
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email || !formData.username) return;
    if (!editingId && formData.password.length < 6) return;

    setLoadError(null);
    setSaving(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = {
          name: formData.name,
          email: formData.email,
          username: formData.username,
          role: formData.role,
          status: formData.status,
          permissions: formData.permissions,
        };
        if (formData.password.length >= 6) body.password = formData.password;
        const updated = await updateStaffAccount(editingId, body);
        if (isStaffPayload(updated)) {
          setStaffList((prev) =>
            prev.map((s) =>
              s.id === editingId
                ? {
                    ...s,
                    ...updated,
                    permissions: Array.isArray(updated.permissions) ? updated.permissions : formData.permissions,
                  }
                : s,
            ),
          );
        } else await loadStaff();
      } else {
        await createStaffAccount({
          name: formData.name,
          email: formData.email,
          username: formData.username,
          password: formData.password,
          role: formData.role,
          status: formData.status,
          permissions: formData.permissions,
        });
        await loadStaff();
      }
      setIsModalOpen(false);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isInitialLoad) {
    return (
      <div className="flex flex-col h-full items-center justify-center min-h-[400px] bg-[#131314]">
        <SectionLoader label="Loading staff from database…" accentColor="#F97316" />
      </div>
    );
  }

  const createPasswordOk = editingId ? true : formData.password.length >= 6;
  const canSubmit = !!(formData.name && formData.email && formData.username && createPasswordOk);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-[#1A1A1A] p-6 rounded-2xl border border-white/5">
        <div>
          <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
            Staff Roles & Access Management
          </h2>
          <p className="text-gray-400">Manage staff and admin accounts from the database</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="bg-[#FF8C00] hover:bg-[#e67e00] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" /> Create Staff Account
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300 text-sm font-semibold">
          {loadError}
        </div>
      )}

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
              {staffList.map((staff) => (
                <tr key={staff.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{staff.name}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-gray-300">{staff.email}</div>
                    <div className="text-xs text-gray-500">@{staff.username}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-[#0047AB]/20 text-[#60a5fa] rounded-full text-xs font-bold">
                      {staff.role === "admin" ? "Super Admin" : "Staff"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        staff.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      }`}
                    >
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
                        onClick={() => void toggleStatus(staff)}
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
              {staffList.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    No staff or admin accounts found. Users must have role <code className="text-gray-500">staff</code> or{" "}
                    <code className="text-gray-500">admin</code> in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181819] w-full max-w-3xl rounded-3xl border border-white/10 overflow-hidden max-h-[92vh] flex flex-col shadow-2xl shadow-black/50">
            <div className="p-6 border-b border-white/5 flex justify-between items-start gap-4 flex-shrink-0" style={{ background: "linear-gradient(135deg,rgba(255,140,0,0.10),rgba(0,71,171,0.08),transparent)" }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,140,0,0.16)", border: "1px solid rgba(255,140,0,0.28)" }}>
                  <UserCog className="w-6 h-6 text-[#FF8C00]" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-white">
                    {editingId ? "Edit Staff Account" : "Create Staff Account"}
                  </h3>
                  <p className="text-gray-500 mt-1" style={{ fontSize: 12 }}>
                    Configure identity, role, and exact module access for JRC SportSync.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-2xl bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { key: "name", label: "Full Name", placeholder: "e.g. Juan Staff", type: "text", icon: BadgeCheck },
                  { key: "email", label: "Email Address", placeholder: "staff@jrc.com", type: "email", icon: Mail },
                  { key: "username", label: "Username", placeholder: "jstaff", type: "text", icon: AtSign },
                ].map((field) => {
                  const Icon = field.icon;
                  return (
                    <label key={field.key} className="group rounded-2xl p-3 border border-white/8 bg-[#101011] focus-within:border-[#FF8C00]/60 transition-colors">
                      <span className="flex items-center gap-2 text-gray-500 font-black uppercase mb-2" style={{ fontSize: 10 }}>
                        <Icon className="w-3.5 h-3.5 text-[#FF8C00]" /> {field.label}
                      </span>
                      <input
                        type={field.type}
                        value={(formData as any)[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full bg-transparent text-white placeholder:text-gray-700 focus:outline-none font-bold"
                        style={{ fontSize: 14 }}
                        placeholder={field.placeholder}
                      />
                    </label>
                  );
                })}

                <label className="group rounded-2xl p-3 border border-white/8 bg-[#101011] focus-within:border-[#FF8C00]/60 transition-colors">
                  <span className="flex items-center gap-2 text-gray-500 font-black uppercase mb-2" style={{ fontSize: 10 }}>
                    <KeyRound className="w-3.5 h-3.5 text-[#FF8C00]" /> Password {editingId && <span className="normal-case text-gray-600">(optional)</span>}
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="new-staff-password"
                      autoComplete="new-password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-transparent text-white placeholder:text-gray-700 focus:outline-none pr-10 font-bold"
                      style={{ fontSize: 14 }}
                      placeholder={editingId ? "Leave blank to keep current" : "At least 6 characters"}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Role</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { value: "staff" as const, title: "Staff", desc: "Facility operations with selected modules", icon: ShieldCheck, color: "#38BDF8" },
                    { value: "admin" as const, title: "Admin", desc: "Full system access and configuration", icon: UserCog, color: "#FF8C00" },
                  ].map((role) => {
                    const active = formData.role === role.value;
                    const Icon = role.icon;
                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: role.value })}
                        className="rounded-2xl p-4 border text-left transition-all"
                        style={{ background: active ? `${role.color}16` : "#101011", borderColor: active ? `${role.color}55` : "rgba(255,255,255,0.08)" }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${role.color}18`, color: role.color }}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-white font-black" style={{ fontSize: 14 }}>{role.title}</p>
                            <p className="text-gray-500" style={{ fontSize: 11 }}>{role.desc}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {formData.role === "staff" && (
                <div className="space-y-3">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-gray-500 font-black uppercase" style={{ fontSize: 10 }}>Module Access</p>
                      <p className="text-gray-600 mt-1" style={{ fontSize: 11 }}>Choose what this staff account can operate.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, permissions: f.permissions.length === MODULES.length ? [] : [...MODULES] }))}
                      className="px-3 py-1.5 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 font-black"
                      style={{ fontSize: 11 }}
                    >
                      {formData.permissions.length === MODULES.length ? "Clear All" : "Select All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {MODULES.map((mod) => {
                      const meta = MODULE_META[mod];
                      const Icon = meta.icon;
                      const checked = formData.permissions.includes(mod);
                      return (
                        <button
                          key={mod}
                          type="button"
                          onClick={() => handleTogglePermission(mod)}
                          className="rounded-2xl p-3 border text-left transition-all"
                          style={{ background: checked ? `${meta.color}14` : "#101011", borderColor: checked ? `${meta.color}45` : "rgba(255,255,255,0.08)" }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${meta.color}18`, color: meta.color }}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-black truncate" style={{ fontSize: 13 }}>{mod}</p>
                              <p className="text-gray-500 truncate" style={{ fontSize: 11 }}>{meta.desc}</p>
                            </div>
                            <span className="w-5 h-5 rounded-md flex items-center justify-center border" style={{ background: checked ? meta.color : "transparent", borderColor: checked ? meta.color : "rgba(255,255,255,0.18)" }}>
                              {checked && <Check className="w-3.5 h-3.5 text-white" />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 flex gap-4 flex-shrink-0 bg-[#151516]">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canSubmit || saving}
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
