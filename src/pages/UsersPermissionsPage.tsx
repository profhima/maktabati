import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { uid, todayStr } from '../lib/utils';
import { UserProfile, UserRole, UserPermissionSet } from '../types';
import {
  ROLE_PRESETS,
  PERMISSION_DEFINITIONS,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_CASHIER_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_STOCKKEEPER_PERMISSIONS
} from '../lib/permissions';
import { OfflineSyncManager } from '../lib/offlineSync';
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  KeyRound,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Sparkles,
  Search,
  Eye,
  EyeOff,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Check,
  LogIn,
  RefreshCw,
  Cloud
} from 'lucide-react';

export const UsersPermissionsPage: React.FC = () => {
  const {
    db,
    setDb,
    currentUser,
    currentProfile,
    isAdmin,
    toast
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Form State
  const [formUid, setFormUid] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('cashier');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formPermissions, setFormPermissions] = useState<UserPermissionSet>({
    ...DEFAULT_CASHIER_PERMISSIONS
  });

  const usersList = db.userProfiles || [];

  // Filter users
  const filteredUsers = usersList.filter(u => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone || '').includes(searchQuery) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openAddModal = () => {
    setEditingUserId(null);
    setFormUid('');
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('cashier');
    setFormIsActive(true);
    setFormPermissions({ ...DEFAULT_CASHIER_PERMISSIONS });
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserProfile) => {
    setEditingUserId(u.uid || u.id || '');
    setFormUid(u.uid || u.id || '');
    setFormName(u.name || '');
    setFormEmail(u.email || '');
    setFormPhone(u.phone || '');
    setFormRole(u.role || 'cashier');
    setFormIsActive(u.isActive !== false);

    const preset = ROLE_PRESETS[u.role]?.permissions || DEFAULT_CASHIER_PERMISSIONS;
    setFormPermissions({
      ...preset,
      ...(u.permissions || {})
    });
    setIsModalOpen(true);
  };

  const applyRolePreset = (role: UserRole) => {
    setFormRole(role);
    const preset = ROLE_PRESETS[role]?.permissions || DEFAULT_CASHIER_PERMISSIONS;
    setFormPermissions({ ...preset });
    toast(`تم تطبيق قالب صلاحيات: ${ROLE_PRESETS[role]?.label || role}`);
  };

  const handleTogglePermission = (key: keyof UserPermissionSet) => {
    setFormPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast('يرجى إدخال اسم الموظف');
      return;
    }

    const cleanUid = (editingUserId || formUid).trim();
    if (!editingUserId) {
      if (!cleanUid) {
        toast('يرجى إدخال UID الخاص بحساب الموظف من Firebase Console');
        return;
      }
      if (!formEmail.trim()) {
        toast('البريد الإلكتروني مطلوب لربطه بملف الموظف');
        return;
      }
      const existingWithUid = usersList.find(x => x.uid === cleanUid || x.id === cleanUid);
      if (existingWithUid) {
        toast('يوجد موظف مسجل بهذا المعرف (UID) بالفعل');
        return;
      }
    }

    if (formRole === 'admin') {
      toast('لا يمكن إنشاء أو ترقية حساب إلى دور مدير (Admin) من هذه الواجهة. الإدارة محصورة في الحساب الأساسي.');
      return;
    }

    if (editingUserId) {
      const existingUser = usersList.find(x => x.uid === cleanUid || x.id === cleanUid);
      if (existingUser?.role === 'admin' && String(formRole) !== 'admin') {
        toast('لا يمكن تغيير دور حساب المدير (Admin)');
        return;
      }
    }

    setIsSaving(true);
    try {
      const targetUid = cleanUid;
      const existingUser = editingUserId ? usersList.find(x => x.uid === targetUid || x.id === targetUid) : null;

      // Preserve existing PIN security hashes for existing profiles without modifying or writing new ones
      const resolvedPinHash = editingUserId ? existingUser?.pinHash : undefined;
      const resolvedPinSalt = editingUserId ? existingUser?.pinSalt : undefined;

      const newProfile: UserProfile = {
        id: targetUid,
        uid: targetUid,
        name: formName.trim(),
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        role: formRole,
        pinHash: resolvedPinHash,
        pinSalt: resolvedPinSalt,
        isActive: formIsActive,
        permissions: formPermissions,
        createdBy: editingUserId ? existingUser?.createdBy : (currentUser?.uid || 'admin'),
        updatedAt: new Date().toISOString(),
        createdAt: editingUserId
          ? existingUser?.createdAt || new Date().toISOString()
          : new Date().toISOString()
      };

      // 2. Immediately update in-memory state
      const existing = db.userProfiles || [];
      const index = existing.findIndex(x => x.uid === targetUid || x.id === targetUid);
      let updatedList: UserProfile[];
      if (index >= 0) {
        updatedList = [...existing];
        updatedList[index] = newProfile;
      } else {
        updatedList = [newProfile, ...existing];
      }
      setDb(prev => ({ ...prev, userProfiles: updatedList }));

      // 3. Save directly to cloud Firestore /userProfiles/{targetUid}
      if (navigator.onLine) {
        try {
          await fsdb.collection('userProfiles').doc(targetUid).set(newProfile, { merge: true });
        } catch (cloudErr: any) {
          console.warn('Note: Profile write queued for offline sync:', cloudErr.message);
          OfflineSyncManager.enqueueGeneric('userProfile', `موظف: ${formName}`, newProfile);
        }
      } else {
        OfflineSyncManager.enqueueGeneric('userProfile', `موظف: ${formName}`, newProfile);
      }

      toast(editingUserId ? `✅ تم تحديث بيانات وصلاحيات "${formName}"` : `✅ تم تسجيل ملف الموظف "${formName}" بنجاح في Firestore`);
      setIsModalOpen(false);
    } catch (err: any) {
      toast(`❌ خطأ أثناء حفظ الموظف: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncCloudStaff = async () => {
    setIsCloudSyncing(true);
    toast('🔄 جاري فحص ومزامنة بيانات الموظفين والكاشير مع السحابة...');
    try {
      if (!currentUser?.uid) {
        toast('⚠️ يرجى التأكد من تسجيل الدخول بحساب المدير');
        return;
      }

      const snap = await fsdb.collection('userProfiles').get();
      const cloudProfiles: UserProfile[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

      setDb(prev => ({ ...prev, userProfiles: cloudProfiles }));
      toast(`✅ تمت مزامنة ${cloudProfiles.length} حساب موظف بنجاح من قاعدة البيانات السحابية!`);
    } catch (err: any) {
      toast(`⚠️ تعذر جلب الموظفين من السحابة: ${err.message}`);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleDeleteUser = async (u: UserProfile) => {
    if (u.role === 'admin' && usersList.filter(x => x.role === 'admin').length <= 1) {
      toast('⚠️ لا يمكن حذف المدير الوحيد للنظام');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف الموظف "${u.name}"؟`)) {
      return;
    }

    const docId = u.id || u.uid;

    // 1. Remove from local state immediately
    const updatedList = (db.userProfiles || []).filter(x => x.uid !== docId && x.id !== docId);
    setDb(prev => ({ ...prev, userProfiles: updatedList }));

    // 2. Delete document from cloud Firestore
    if (docId && navigator.onLine) {
      fsdb.collection('userProfiles').doc(docId).delete().catch((err: any) => {
        console.warn('Cloud delete notice:', err);
      });
    }

    toast(`تم حذف الموظف "${u.name}"`);
  };

  const handleToggleActive = async (u: UserProfile) => {
    const docId = u.id || u.uid;
    const nextActive = u.isActive === false ? true : false;

    // 1. Update state immediately
    const updatedList = (db.userProfiles || []).map(x =>
      x.uid === docId || x.id === docId ? { ...x, isActive: nextActive } : x
    );
    setDb(prev => ({ ...prev, userProfiles: updatedList }));

    // 2. Sync to cloud Firestore
    if (docId && navigator.onLine) {
      fsdb.collection('userProfiles').doc(docId).set({
        isActive: nextActive,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch((err: any) => {
        console.warn('Cloud toggle notice:', err);
      });
    }

    toast(nextActive ? `🟢 تم تفعيل حساب ${u.name}` : `⚪ تم تعطيل حساب ${u.name}`);
  };

  // Group permission definitions by category
  const categories = [
    { key: 'security', label: '🔐 الأمان المالي والخصوصية (حجب التكاليف والأرباح)' },
    { key: 'sales', label: '🛒 المبيعات ونقاط البيع (POS)' },
    { key: 'inventory', label: '📦 المخازن والتوريدات والمشتريات' },
    { key: 'financials', label: '💰 المالية والخزينة وتقفيل اليومية' },
    { key: 'system', label: '⚙️ إدارة النظام والموظفين' }
  ];

  const adminCount = usersList.filter(u => u.role === 'admin').length;
  const cashierCount = usersList.filter(u => u.role === 'cashier').length;
  const managerCount = usersList.filter(u => u.role === 'manager').length;
  const stockCount = usersList.filter(u => u.role === 'stockkeeper').length;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#A9762F]/15 text-[#A9762F]">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-xl sm:text-2xl font-serif font-black text-[#1F2A3C]">
              إدارة الموظفين وتعيين الصلاحيات (RBAC)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-[#475569]">
            نظام حماية متكامل لفصل الصلاحيات: حجب أسعار التكلفة والأرباح عن الكاشير، تقييد الحذف، وتحديد صلاحيات دقيقة لكل موظف.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleSyncCloudStaff}
            disabled={isCloudSyncing}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm border border-slate-300 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="مزامنة وجلب كافة الموظفين من الخادم السحابي فوراً"
          >
            <RefreshCw className={`w-4 h-4 text-amber-600 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span>{isCloudSyncing ? 'جاري فحص السحابة...' : 'مزامنة الموظفين مع السحابة'}</span>
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة موظف / كاشير جديد</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold text-lg">
            👑
          </div>
          <div>
            <span className="text-xs text-[#64748B] block font-semibold">المدير العام / المالك</span>
            <b className="text-lg font-black font-mono text-[#0F172A]">{adminCount || 1}</b>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-700 flex items-center justify-center font-bold text-lg">
            🛒
          </div>
          <div>
            <span className="text-xs text-[#64748B] block font-semibold">بائعي نقاط البيع (POS)</span>
            <b className="text-lg font-black font-mono text-[#0F172A]">{cashierCount}</b>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center font-bold text-lg">
            👔
          </div>
          <div>
            <span className="text-xs text-[#64748B] block font-semibold">مشرفي الفروع</span>
            <b className="text-lg font-black font-mono text-[#0F172A]">{managerCount}</b>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-700 flex items-center justify-center font-bold text-lg">
            📦
          </div>
          <div>
            <span className="text-xs text-[#64748B] block font-semibold">مسؤولي المخزن</span>
            <b className="text-lg font-black font-mono text-[#0F172A]">{stockCount}</b>
          </div>
        </div>
      </div>

      {/* Authenticated Session Info Banner */}
      <div className="p-3.5 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#92400E]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <b>حساب الجلسة الحالي (Firebase Auth):</b>{' '}
            <span className="font-bold underline">
              {currentProfile ? `${currentProfile.name} (${ROLE_PRESETS[currentProfile.role]?.label || currentProfile.role})` : (currentUser?.email || 'مستخدم مسجل')}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-amber-800">
          <span>UID: {currentUser?.uid}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#8E98A6] absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
            placeholder="ابحث بالاسم، الهاتف، أو البريد..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {['all', 'admin', 'manager', 'cashier', 'stockkeeper'].map(roleKey => (
            <button
              key={roleKey}
              onClick={() => setRoleFilter(roleKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                roleFilter === roleKey
                  ? 'bg-[#A9762F] text-white'
                  : 'bg-[#F6F1E7] text-[#3A4A63] hover:bg-[#EFE7D6]'
              }`}
            >
              {roleKey === 'all' ? 'جميع الأدوار' : ROLE_PRESETS[roleKey as UserRole]?.label.split(' ')[0] || roleKey}
            </button>
          ))}
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* If no users yet, show quick setup guide */}
        {usersList.length === 0 && (
          <div className="col-span-full p-8 rounded-3xl bg-[#FFFDF8] border-2 border-dashed border-[#D8CBB0] text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-[#A9762F]/10 text-[#A9762F] flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="font-serif font-black text-lg text-[#1F2A3C]">لا يوجد موظفين إضافيين مسجلين بعد</h3>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto">
              أنت تعمل حالياً بحساب المالك الرئيسي. أضف حسابات للبائعين (الكاشير) لمنعهم من رؤية أسعار التكلفة أو الأرباح وقفل إمكانية حذف الفواتير.
            </p>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة كاشير / بائع الآن</span>
            </button>
          </div>
        )}

        {filteredUsers.map(u => {
          const preset = ROLE_PRESETS[u.role] || ROLE_PRESETS.cashier;
          const isActive = u.isActive !== false;
          const isCurrentUser = currentUser?.uid === (u.uid || u.id);
          const uPerms = u.permissions || preset.permissions;

          return (
            <div
              key={u.id || u.uid}
              className={`p-5 rounded-3xl bg-[#FFFDF8] border transition-all flex flex-col justify-between ${
                isCurrentUser
                  ? 'border-emerald-500 ring-2 ring-emerald-400/30 shadow-md'
                  : isActive
                  ? 'border-[#D8CBB0] shadow-xs hover:border-[#A9762F]'
                  : 'border-slate-300 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#EFE7D6] flex items-center justify-center text-xl shadow-2xs font-bold">
                      {preset.icon || '👤'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-serif font-black text-sm text-[#1F2A3C]">{u.name}</h3>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full">
                            حساب الجلسة الحالي
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[#64748B] block">{u.phone || u.email || 'بدون هاتف'}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                      u.role === 'admin'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : u.role === 'manager'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : u.role === 'stockkeeper'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {preset.label.split(' ')[0]}
                  </span>
                </div>

                {/* Security Status Bar */}
                <div className="p-2.5 rounded-xl bg-[#F6F1E7] border border-[#EFE7D6] flex items-center justify-between text-xs mb-3">
                  <div className="flex items-center gap-1.5 text-[#475569]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#A9762F]" />
                    <span>حالة الحساب:</span>
                    <span className={`font-semibold text-[11px] px-2 py-0.5 rounded-lg border ${
                      isActive ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-rose-800 bg-rose-50 border-rose-200'
                    }`}>
                      {isActive ? 'حساب نشط' : 'حساب معطّل'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                      isActive ? 'text-emerald-700 hover:bg-emerald-100' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        حساب نشط
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 text-slate-400" />
                        حساب معطل
                      </>
                    )}
                  </button>
                </div>

                {/* Permissions Highlights */}
                <div className="space-y-1 text-xs text-[#475569] mb-4">
                  <div className="flex items-center justify-between py-1 border-b border-[#EFE7D6]">
                    <span>رؤية أسعار التكلفة:</span>
                    <b className={uPerms.viewCostPrice ? 'text-emerald-600' : 'text-rose-600'}>
                      {uPerms.viewCostPrice ? 'مسموح' : '🚫 محجوب تماماً'}
                    </b>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#EFE7D6]">
                    <span>رؤية الأرباح وصافي الدخل:</span>
                    <b className={uPerms.viewProfits ? 'text-emerald-600' : 'text-rose-600'}>
                      {uPerms.viewProfits ? 'مسموح' : '🚫 محجوب تماماً'}
                    </b>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-[#EFE7D6]">
                    <span>الوصول للخزينة وتقفيل اليومية:</span>
                    <b className={uPerms.treasuryManage ? 'text-emerald-600' : 'text-slate-500'}>
                      {uPerms.treasuryManage ? 'مسموح' : 'غير متاح'}
                    </b>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span>حذف أو إلغاء فواتير قديمة:</span>
                    <b className={uPerms.deleteInvoices ? 'text-amber-600' : 'text-slate-500'}>
                      {uPerms.deleteInvoices ? 'مسموح' : 'ممنوع'}
                    </b>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#EFE7D6] flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(u)}
                    className="p-2 rounded-xl bg-[#F6F1E7] hover:bg-[#EFE7D6] text-[#1F2A3C] transition-colors cursor-pointer"
                    title="تعديل الموظف وتخصيص الصلاحيات"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
                    title="حذف الموظف"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isCurrentUser ? (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>جلسة الدخول النشطة</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium font-mono">
                    UID: {u.uid ? `${u.uid.slice(0, 10)}...` : 'غير مرتبط'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#FFFDF8] border border-[#D8CBB0] rounded-3xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-[#FAF6EE] border-b border-[#EFE7D6] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#A9762F]/15 text-[#A9762F]">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="font-serif font-black text-base sm:text-lg text-[#1F2A3C]">
                    {editingUserId ? 'تعديل بيانات وصلاحيات الموظف' : 'إضافة موظف / كاشير جديد للنظام'}
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    حدد الدور المناسب أو خصص الصلاحيات بدقة لتحقيق أعلى درجات الأمان المالي
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveUser} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#3A4A63] mb-1">
                    اسم الموظف / البائع <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
                    placeholder="مثال: أحمد عبد الله (كاشير الفرع)"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#3A4A63] mb-1">
                    البريد الإلكتروني (لتسجيل الدخول) {!editingUserId && <span className="text-rose-600">*</span>}
                  </label>
                  <input
                    type="email"
                    required={!editingUserId}
                    disabled={!!editingUserId}
                    className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40 disabled:opacity-60"
                    placeholder="cashier@maktabati.com"
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                  />
                  <span className="text-[10px] text-[#64748B] block mt-0.5">
                    {editingUserId ? 'معرف الدخول الأساسي للموظف في Firebase Auth' : 'يُستخدم لتسجيل دخول الموظف المستقل'}
                  </span>
                </div>

                {!editingUserId ? (
                  <div>
                    <label className="block text-xs font-bold text-[#3A4A63] mb-1">
                      معرف المستخدم في Firebase (UID) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 text-sm font-mono bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
                      placeholder="انسخ الـ UID من Firebase Console"
                      value={formUid}
                      onChange={e => setFormUid(e.target.value)}
                    />
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      يتم إنشاؤه يدويًا أولاً من Firebase Console ← Authentication ← Add user
                    </span>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-[#3A4A63] mb-1">
                      معرف المستخدم (UID)
                    </label>
                    <input
                      type="text"
                      disabled
                      className="w-full px-3 py-2 text-sm font-mono bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl opacity-60"
                      value={formUid}
                    />
                    <span className="text-[10px] text-[#64748B] block mt-0.5">
                      معرف حساب Firebase Auth المرتبط بالملف
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#3A4A63] mb-1">رقم الهاتف (اختياري)</label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
                    placeholder="010XXXXXXXX"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-[#3A4A63] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={e => setFormIsActive(e.target.checked)}
                      className="w-4 h-4 text-[#A9762F] rounded-sm focus:ring-[#A9762F]"
                    />
                    <span>الحساب مفعّل ونشط</span>
                  </label>
                </div>
              </div>

              {/* 1-Click Role Presets */}
              <div className="p-4 rounded-2xl bg-[#F6F1E7] border border-[#D8CBB0] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1F2A3C] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#A9762F]" />
                    قوالب الصلاحيات الجاهزة (بنقرة واحدة):
                  </span>
                  <span className="text-[11px] text-[#64748B]">يمكنك تخصيص أي صلاحية بالأسفل</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['cashier', 'manager', 'stockkeeper'] as UserRole[]).map(roleKey => {
                    const preset = ROLE_PRESETS[roleKey];
                    const isSelected = formRole === roleKey;
                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => applyRolePreset(roleKey)}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-[#A9762F] ring-2 ring-[#A9762F]/30 shadow-xs'
                            : 'bg-white/60 border-[#D8CBB0] hover:bg-white hover:border-[#A9762F]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-base">{preset.icon}</span>
                          <b className="text-xs text-[#1F2A3C]">{preset.label.split(' ')[0]}</b>
                        </div>
                        <p className="text-[10px] text-[#64748B] line-clamp-2 leading-tight">
                          {preset.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Granular Permission Matrix */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#EFE7D6]">
                  <h3 className="font-serif font-black text-sm text-[#1F2A3C] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#A9762F]" />
                    مصفوفة الصلاحيات التفصيلية (Granular Permissions):
                  </h3>
                  <span className="text-xs text-[#64748B]">
                    المفعل: {Object.values(formPermissions).filter(Boolean).length} من {PERMISSION_DEFINITIONS.length}
                  </span>
                </div>

                {categories.map(cat => {
                  const permsInCat = PERMISSION_DEFINITIONS.filter(p => p.category === cat.key);
                  if (permsInCat.length === 0) return null;

                  return (
                    <div key={cat.key} className="p-3.5 rounded-2xl bg-white border border-[#EFE7D6] space-y-2.5">
                      <h4 className="text-xs font-bold text-[#1F2A3C]">{cat.label}</h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {permsInCat.map(perm => {
                          const isChecked = !!formPermissions[perm.key];
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-colors cursor-pointer select-none ${
                                isChecked
                                  ? perm.isSensitive
                                    ? 'bg-amber-50/70 border-amber-300'
                                    : 'bg-emerald-50/50 border-emerald-300'
                                  : 'bg-[#FAF6EE] border-transparent hover:border-[#D8CBB0]'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(perm.key)}
                                className="w-4 h-4 mt-0.5 text-[#A9762F] rounded-sm focus:ring-[#A9762F]"
                              />
                              <div className="flex-1">
                                <span className="block text-xs font-bold text-[#1F2A3C]">
                                  {perm.label}
                                </span>
                                <span className="block text-[11px] text-[#64748B] leading-tight">
                                  {perm.description}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-[#EFE7D6] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#475569] hover:bg-[#EFE7D6] transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingUserId ? (isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات') : (isSaving ? 'جاري إنشاء الحساب...' : 'إضافة الموظف الآن')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
