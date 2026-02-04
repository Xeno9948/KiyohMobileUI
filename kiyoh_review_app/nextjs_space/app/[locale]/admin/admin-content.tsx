"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, CheckCircle, Clock, Star, Search, Filter, RefreshCw, Key, Copy, AlertCircle, Loader2, X, Building2, Sparkles, ToggleLeft, ToggleRight, Edit2 } from "lucide-react";

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  createdAt: string;
  lastLoginAt?: string;
  hasApiSetup: boolean;
  companyName?: string;
  locationId?: string;
  invitesSent: number;
  reviewCount: number;
}

interface Company {
  id: string;
  name: string;
  locationId: string;
  tenantId: string;
  baseUrl: string;
  isActive: boolean;
  aiEnabled: boolean;
  createdAt: string;
  _count: {
    users: number;
    invites: number;
  };
}

type TabType = "users" | "companies";

export default function AdminContent() {
  const t = useTranslations('Admin');
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterApi, setFilterApi] = useState<"all" | "yes" | "no">("all");
  const [resetModal, setResetModal] = useState<User | null>(null);
  const [resetting, setResetting] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [error, setError] = useState("");
  const [togglingAI, setTogglingAI] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<Company | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", locationId: "", apiToken: "" });



  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
      }
    } catch (err) {
      console.error("Failed to fetch companies:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAI = async (companyId: string, currentValue: boolean) => {
    setTogglingAI(companyId);
    try {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, aiEnabled: !currentValue }),
      });

      if (res.ok) {
        setCompanies(companies.map(c =>
          c.id === companyId ? { ...c, aiEnabled: !currentValue } : c
        ));
      }
    } catch (err) {
      console.error("Failed to toggle AI:", err);
    } finally {
      setTogglingAI(null);
    }
  };

  const handleEditClick = (company: Company) => {
    setEditModal(company);
    setEditForm({ name: company.name, locationId: company.locationId, apiToken: "" }); // apiToken is hidden, so start empty
    setError("");
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditForm({ name: "", locationId: "", apiToken: "" });
    setError("");
  };

  const handleSaveCompany = async () => {
    if (!editModal) return;
    setSavingCompany(true);
    setError("");

    try {
      const res = await fetch("/api/admin/companies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: editModal.id,
          name: editForm.name,
          locationId: editForm.locationId,
          apiToken: editForm.apiToken || undefined // Only send if changed
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      setCompanies(companies.map(c =>
        c.id === editModal.id ? { ...c, ...data.company } : c
      ));
      closeEditModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingCompany(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else {
      fetchCompanies();
    }
  }, [activeTab]);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterApi === "all" ||
      (filterApi === "yes" && user.hasApiSetup) ||
      (filterApi === "no" && !user.hasApiSetup);
    return matchesSearch && matchesFilter;
  });

  const userStats = {
    total: users.length,
    apiConfigured: users.filter((u) => u.hasApiSetup).length,
    activeRecently: users.filter((u) => {
      if (!u.lastLoginAt) return false;
      const lastLogin = new Date(u.lastLoginAt);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastLogin > dayAgo;
    }).length,
    totalReviews: users.reduce((sum, u) => sum + u.reviewCount, 0),
  };

  const companyStats = {
    total: companies.length,
    aiEnabled: companies.filter((c) => c.aiEnabled).length,
    totalUsers: companies.reduce((sum, c) => sum + c._count.users, 0),
    totalInvites: companies.reduce((sum, c) => sum + c._count.invites, 0),
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    setResetting(true);
    setError("");

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetModal.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");

      setTempPassword(data.tempPassword);
    } catch (err: any) {
      setError(err.message || "Kon wachtwoord niet resetten");
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempPassword);
  };

  const closeResetModal = () => {
    setResetModal(null);
    setTempPassword("");
    setError("");
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-[#3d3d3d]">{t('title')}</h1>
        <p className="text-gray-500">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("users")}
          className={`px-4 py-2 font-medium text-sm transition-all border-b-2 -mb-px ${activeTab === "users"
            ? "border-[#6bbc4a] text-[#6bbc4a]"
            : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
        >
          <Users size={16} className="inline-block mr-2" />
          {t('tabs.users')}
        </button>
        <button
          onClick={() => setActiveTab("companies")}
          className={`px-4 py-2 font-medium text-sm transition-all border-b-2 -mb-px ${activeTab === "companies"
            ? "border-[#6bbc4a] text-[#6bbc4a]"
            : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
        >
          <Building2 size={16} className="inline-block mr-2" />
          {t('tabs.companies')}
        </button>
      </div>

      {/* Stats Cards */}
      {
        activeTab === "users" ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('stats.totalUsers'), value: userStats.total, icon: Users, color: "#6bbc4a" },
              { label: t('stats.apiConfigured'), value: userStats.apiConfigured, icon: CheckCircle, color: "#6bbc4a" },
              { label: t('stats.activeRecently'), value: userStats.activeRecently, icon: Clock, color: "#ffcc01" },
              { label: t('stats.totalReviews'), value: userStats.totalReviews.toLocaleString("nl-NL"), icon: Star, color: "#eb5b0c" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="kiyoh-card p-5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${stat.color}20` }}
                  >
                    <stat.icon size={20} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#3d3d3d]">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('stats.totalCompanies'), value: companyStats.total, icon: Building2, color: "#6bbc4a" },
              { label: t('stats.aiEnabled'), value: companyStats.aiEnabled, icon: Sparkles, color: "#6bbc4a" },
              { label: t('stats.totalUsers'), value: companyStats.totalUsers, icon: Users, color: "#ffcc01" },
              { label: t('stats.sentInvites'), value: companyStats.totalInvites.toLocaleString("nl-NL"), icon: CheckCircle, color: "#eb5b0c" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="kiyoh-card p-5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${stat.color}20` }}
                  >
                    <stat.icon size={20} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-[#3d3d3d]">{stat.value}</p>
                    <p className="text-xs text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      }

      {/* Filters - Only for Users tab */}
      {
        activeTab === "users" && (
          <div className="kiyoh-card p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="kiyoh-input pl-11"
                  placeholder={t('searchPlaceholder')}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{t('filterApi')}</span>
                {[
                  { value: "all", label: "All" },
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilterApi(option.value as any)}
                    className={`filter-tag ${filterApi === option.value ? "active" : ""}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button onClick={fetchUsers} className="btn-secondary flex items-center gap-2">
                <RefreshCw size={16} />
                {t('refresh')}
              </button>
            </div>
          </div>
        )
      }

      {/* Companies Refresh Button */}
      {
        activeTab === "companies" && (
          <div className="flex justify-end">
            <button onClick={fetchCompanies} className="btn-secondary flex items-center gap-2">
              <RefreshCw size={16} />
              {t('refresh')}
            </button>
          </div>
        )
      }

      {/* Content Tables */}
      {
        loading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <RefreshCw className="animate-spin text-[#6bbc4a]" size={48} />
          </div>
        ) : activeTab === "users" ? (
          /* Users Table */
          <div className="kiyoh-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-gray-600">{t('table.user')}</th>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-gray-600">{t('table.company')}</th>
                    <th className="text-center py-4 px-5 text-sm font-semibold text-gray-600">{t('table.api')}</th>
                    <th className="text-center py-4 px-5 text-sm font-semibold text-gray-600">{t('table.reviews')}</th>
                    <th className="text-center py-4 px-5 text-sm font-semibold text-gray-600">{t('table.invites')}</th>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-gray-600">{t('table.lastActive')}</th>
                    <th className="text-right py-4 px-5 text-sm font-semibold text-gray-600">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        {t('searchPlaceholder')}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-5">
                          <div>
                            <p className="font-medium text-[#3d3d3d]">{user.name || "-"}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          {user.companyName ? (
                            <div>
                              <p className="text-[#3d3d3d]">{user.companyName}</p>
                              <p className="text-xs text-gray-400 font-mono">ID: {user.locationId}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center">
                          {user.hasApiSetup ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-600 text-xs font-medium">
                              <CheckCircle size={12} />
                              Yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                              No
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center font-medium text-[#3d3d3d]">
                          {user.reviewCount.toLocaleString()}
                        </td>
                        <td className="py-4 px-5 text-center text-gray-600">
                          {user.invitesSent}
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-500">
                          {formatDate(user.lastLoginAt)}
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => setResetModal(user)}
                            className="filter-tag hover:border-[#eb5b0c] hover:text-[#eb5b0c]"
                          >
                            <Key size={14} />
                            {t('actions.reset')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Companies Table */
          <div className="kiyoh-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-gray-600">{t('table.company')}</th>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-gray-600">{t('table.locationId')}</th>
                    <th className="text-center py-4 px-5 text-sm font-semibold text-gray-600">{t('stats.totalUsers')}</th>
                    <th className="text-center py-4 px-5 text-sm font-semibold text-gray-600">{t('table.invites')}</th>
                    <th className="text-left py-4 px-5 text-sm font-semibold text-gray-600">{t('table.created')}</th>
                    <th className="text-center py-4 px-5 text-sm font-semibold text-gray-600">{t('table.ai')}</th>
                    <th className="text-right py-4 px-5 text-sm font-semibold text-gray-600">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        {t('searchPlaceholder')}
                      </td>
                    </tr>
                  ) : (
                    companies.map((company) => (
                      <tr key={company.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-5">
                          <p className="font-medium text-[#3d3d3d]">{company.name}</p>
                        </td>
                        <td className="py-4 px-5">
                          <code className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {company.locationId}
                          </code>
                        </td>
                        <td className="py-4 px-5 text-center font-medium text-[#3d3d3d]">
                          {company._count.users}
                        </td>
                        <td className="py-4 px-5 text-center text-gray-600">
                          {company._count.invites}
                        </td>
                        <td className="py-4 px-5 text-sm text-gray-500">
                          {formatDate(company.createdAt)}
                        </td>
                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => toggleAI(company.id, company.aiEnabled)}
                            disabled={togglingAI === company.id}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${company.aiEnabled
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                              }`}
                          >
                            {togglingAI === company.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : company.aiEnabled ? (
                              <ToggleRight size={16} />
                            ) : (
                              <ToggleLeft size={16} />
                            )}
                            {company.aiEnabled ? t('actions.on') : t('actions.off')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      {/* Reset Password Modal */}
      {
        resetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeResetModal}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#3d3d3d]">{t('modals.resetTitle')}</h3>
                <button onClick={closeResetModal} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              {tempPassword ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-green-700 mb-2">{t('modals.tempPassword')} {resetModal.email}:</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-white px-3 py-2 rounded-lg font-mono text-[#3d3d3d] border border-green-200">
                        {tempPassword}
                      </code>
                      <button onClick={copyToClipboard} className="btn-secondary !p-2" title="Copy">
                        <Copy size={18} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Deel dit wachtwoord veilig met de gebruiker. Ze moeten het bij eerste login wijzigen.
                  </p>
                  <button onClick={closeResetModal} className="w-full btn-kiyoh justify-center">
                    {t('actions.cancel')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    {t('modals.resetConfirm')} <strong>{resetModal.email}</strong>?
                  </p>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={closeResetModal} className="flex-1 btn-secondary">
                      {t('actions.cancel')}
                    </button>
                    <button onClick={handleResetPassword} disabled={resetting} className="flex-1 btn-kiyoh justify-center disabled:opacity-50">
                      {resetting ? <Loader2 className="animate-spin" size={18} /> : <Key size={18} />}
                      {resetting ? "Resetting..." : t('modals.resetTitle')}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )
      }
      {/* Edit Company Modal */}
      {
        editModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeEditModal}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[#3d3d3d]">{t('modals.editTitle')}</h3>
                <button onClick={closeEditModal} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{t('modals.companyName')}</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="kiyoh-input w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{t('table.locationId')}</label>
                  <input
                    type="text"
                    value={editForm.locationId}
                    onChange={(e) => setEditForm({ ...editForm, locationId: e.target.value })}
                    className="kiyoh-input w-full bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">{t('modals.updateToken')}</label>
                  <input
                    type="text"
                    value={editForm.apiToken}
                    onChange={(e) => setEditForm({ ...editForm, apiToken: e.target.value })}
                    className="kiyoh-input w-full font-mono text-sm"
                    placeholder="Leave empty to keep current"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only fill if you want to set a new token.</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={closeEditModal} className="flex-1 btn-secondary">
                    {t('actions.cancel')}
                  </button>
                  <button onClick={handleSaveCompany} disabled={savingCompany} className="flex-1 btn-kiyoh justify-center disabled:opacity-50">
                    {savingCompany ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                    {savingCompany ? t('actions.save') : t('actions.save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )
      }
    </div >
  );
}

