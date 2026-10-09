import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Clock, 
  CheckCircle2, 
  Flame, 
  Plus, 
  RefreshCw, 
  Bell, 
  TrendingUp, 
  FileSpreadsheet, 
  AlertTriangle, 
  Key, 
  Filter, 
  ChevronRight, 
  LayoutGrid, 
  ListFilter,
  Check,
  RotateCcw,
  Building2,
  FolderPlus,
  UserCheck
} from 'lucide-react';

const API_GATEWAY = "https://tasks.seosiri.com";

interface Task {
  task_id: string;
  tenant_id: string;
  dept_id: string;
  assigned_to: string;
  title: string;
  description: string;
  status: 'URGENT' | 'PROGRESS' | 'PENDING' | 'COMPLETE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  source: string;
  created_at: string;
}

interface Department {
  dept_id: string;
  dept_name: string;
}

interface Digest {
  total_tasks: number;
  completed: number;
  in_progress: number;
  urgent_queue: number;
  blockers_reported: number;
  completion_velocity: string;
}

interface TenantStats {
  tenant_id: string;
  company_name: string;
  tier: string;
  active_seats: number;
  max_seats: number;
  is_free_tier: boolean;
}

export default function App() {
  // Session Identity State
  const [employeeId, setEmployeeId] = useState('ETMAGJUMR62');
  const [customIdInput, setCustomIdInput] = useState('');
  const [isAdmin, setIsAdmin] = useState(true);
  
  // Dynamic Organization Departments
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('ALL');
  
  // View Toggle
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  
  // Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [tenantStats, setTenantStats] = useState<TenantStats | null>(null);
  const [unreadPings, setUnreadPings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showPingsModal, setShowPingsModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState<string | null>(null);
  
  // Form Inputs
  const [newDeptId, setNewDeptId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [blockerText, setBlockerText] = useState('');
  const [licenseTokenInput, setLicenseTokenInput] = useState('');
  const [licenseStatusMsg, setLicenseStatusMsg] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDept, setNewTaskDept] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [newTaskUrgent, setNewTaskUrgent] = useState(false);
  const [rawCsvText, setRawCsvText] = useState('');
  const [activeTaskForComments, setActiveTaskForComments] = useState<Task | null>(null);
  const [taskComments, setTaskComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [autoDispatchStatus, setAutoDispatchStatus] = useState<string | null>(null);

  const fetchComments = async (taskId: string) => {
    try {
      const res = await fetch(`${API_GATEWAY}/v1/tasks/${taskId}/comments`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const data = await res.json();
      setTaskComments(data.comments || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTaskForComments || !newCommentText.trim()) return;

    try {
      await fetch(`${API_GATEWAY}/v1/tasks/${activeTaskForComments.task_id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({ content: newCommentText.trim() })
      });
      setNewCommentText('');
      fetchComments(activeTaskForComments.task_id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAutoDispatch = async () => {
    setAutoDispatchStatus("Querying department backlog...");
    try {
      const res = await fetch(`${API_GATEWAY}/v1/tasks/auto-dispatch`, {
        method: "POST",
        headers: { "X-Employee-ID": employeeId }
      });
      const data = await res.json();
      if (data.status === "DISPATCHED") {
        setAutoDispatchStatus(`Dispatched: ${data.task.title}`);
        fetchTasksAndTelemetry();
      } else {
        setAutoDispatchStatus(data.message || "No tasks available.");
      }
      setTimeout(() => setAutoDispatchStatus(null), 4000);
    } catch (e) {
      setAutoDispatchStatus("Dispatch failed.");
    }
  };


  // 1. Fetch Dynamic Departments from Edge
  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_GATEWAY}/v1/departments`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const data = await res.json();
      if (data.departments && Array.isArray(data.departments)) {
        setDepartments(data.departments);
        if (data.departments.length > 0 && !newTaskDept) {
          setNewTaskDept(data.departments[0].dept_id);
        }
      }
    } catch (err) {
      console.error("Departments Fetch Error", err);
    }
  };

  // 2. Fetch Tasks, Telemetry & Digest
  const fetchTasksAndTelemetry = async () => {
    setLoading(true);
    try {
      const deptQuery = selectedDept !== 'ALL' ? `?dept=${selectedDept}` : '';
      const res = await fetch(`${API_GATEWAY}/v1/tasks${deptQuery}`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
        setIsAdmin(data.role === 'ADMIN');
      }

      // Fetch Pings
      const pingRes = await fetch(`${API_GATEWAY}/v1/notifications/ping`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const pingData = await pingRes.json();
      if (pingData.notifications) setUnreadPings(pingData.notifications);

      // Fetch Tenant Stats
      const statsRes = await fetch(`${API_GATEWAY}/v1/tenants/stats`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const statsData = await statsRes.json();
      if (statsData.tenant_id) setTenantStats(statsData);

      // Fetch Digest
      if (data.role === 'ADMIN' || data.role === 'DEPT_HEAD') {
        const digRes = await fetch(`${API_GATEWAY}/v1/analytics/digest`, {
          headers: { "X-Employee-ID": employeeId }
        });
        const digData = await digRes.json();
        if (digData.digest) setDigest(digData.digest);
      } else {
        setDigest(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchTasksAndTelemetry();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTasksAndTelemetry();
    }, 15000);
    return () => clearInterval(interval);
  }, [employeeId, selectedDept]);

  const handleStatusChange = async (taskId: string, newStatus: string, blockerReason?: string) => {
    try {
      const res = await fetch(`${API_GATEWAY}/v1/tasks/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({ taskId, newStatus, blockerReason })
      });
      const json = await res.json();
      if (json.status === "TRANSITION_LOGGED") fetchTasksAndTelemetry();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcknowledgePing = async (notificationId: string) => {
    try {
      await fetch(`${API_GATEWAY}/v1/notifications/ack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({ notificationId })
      });
      setUnreadPings(prev => prev.filter(p => p.notification_id !== notificationId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptId.trim() || !newDeptName.trim()) return;

    try {
      const res = await fetch(`${API_GATEWAY}/v1/departments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({ deptId: newDeptId.trim(), deptName: newDeptName.trim() })
      });
      const data = await res.json();
      if (data.status === "DEPARTMENT_CREATED") {
        setShowDeptModal(false);
        setNewDeptId('');
        setNewDeptName('');
        fetchDepartments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActivateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseTokenInput.trim()) return;

    try {
      const res = await fetch(`${API_GATEWAY}/v1/tenants/license`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({ licenseToken: licenseTokenInput.trim() })
      });
      const json = await res.json();
      if (json.status === "LICENSE_ACTIVATED") {
        setLicenseStatusMsg(`Tier upgraded: ${json.tier} (${json.max_seats} Seats)!`);
        setTimeout(() => {
          setShowLicenseModal(false);
          setLicenseStatusMsg('');
          fetchTasksAndTelemetry();
        }, 2000);
      } else {
        setLicenseStatusMsg(json.message || "Activation Failed.");
      }
    } catch (err) {
      setLicenseStatusMsg("Connection Error.");
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const res = await fetch(`${API_GATEWAY}/v1/tasks/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({
          title: newTaskTitle,
          assignedTo: newTaskAssignee || employeeId,
          deptId: newTaskDept || (departments[0]?.dept_id || "OPERATIONS"),
          priority: newTaskPriority,
          isUrgent: newTaskUrgent
        })
      });
      const data = await res.json();
      if (data.status === "ASSIGNED") {
        setShowAssignModal(false);
        setNewTaskTitle('');
        setNewTaskAssignee('');
        fetchTasksAndTelemetry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkCsvSubmit = async () => {
    if (!rawCsvText.trim()) return;

    const lines = rawCsvText.trim().split('\n');
    const parsedTasks = lines.slice(1).map(line => {
      const [title, assignedTo, deptId, priority, isUrgent] = line.split(',').map(s => s?.trim());
      return {
        title: title || "Untitled Task",
        assignedTo: assignedTo || employeeId,
        deptId: deptId || (departments[0]?.dept_id || "OPERATIONS"),
        priority: (priority as any) || "MEDIUM",
        isUrgent: isUrgent === "true" || isUrgent === "1"
      };
    });

    try {
      const res = await fetch(`${API_GATEWAY}/v1/tasks/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Employee-ID": employeeId
        },
        body: JSON.stringify({ tasks: parsedTasks })
      });
      const data = await res.json();
      if (data.status === "BULK_INGESTED_SUCCESSFULLY") {
        setShowCsvModal(false);
        setRawCsvText('');
        fetchTasksAndTelemetry();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const urgentTasks = tasks.filter(t => t.status === 'URGENT');
  const progressTasks = tasks.filter(t => t.status === 'PROGRESS');
  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const completeTasks = tasks.filter(t => t.status === 'COMPLETE');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      
      {/* 1. Global Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-3.5 sticky top-0 z-40 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 p-2 flex items-center justify-center shrink-0 shadow-lg border border-blue-400/30">
                <Shield className="w-5 h-5 text-white" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                    SEOSiri Task Sentinel
                  </h1>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                    {tenantStats ? tenantStats.company_name : "Enterprise Global"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono tracking-tight">
                  Autonomous Workforce Velocity &amp; Task Orchestration
                </p>
              </div>
            </div>

            <button
              onClick={() => { fetchDepartments(); fetchTasksAndTelemetry(); }}
              disabled={loading}
              className="md:hidden p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

          {/* Dynamic Controls Header */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 w-full md:w-auto text-xs font-mono">
            {tenantStats && (
              <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800/90 shadow-sm">
                <span className="text-slate-400">Seats:</span>
                <strong className={tenantStats.active_seats >= tenantStats.max_seats ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                  {tenantStats.active_seats} / {tenantStats.max_seats}
                </strong>
                <span className="text-[10px] text-slate-500 uppercase">({tenantStats.tier})</span>
                {tenantStats.is_free_tier && (
                  <button 
                    onClick={() => setShowLicenseModal(true)}
                    className="ml-1 text-sky-400 hover:underline font-bold text-[10px]"
                  >
                    [Upgrade]
                  </button>
                )}
              </div>
            )}

            {/* Dynamic Department Filter */}
            {isAdmin && (
              <div className="flex items-center space-x-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select 
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-slate-900 text-slate-100 font-semibold focus:outline-none cursor-pointer max-w-[160px] truncate"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(d => (
                    <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowDeptModal(true)}
                  title="Add Custom Department"
                  className="text-slate-400 hover:text-emerald-400 pl-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Workspace & Role Access Button */}
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2 shadow-sm text-emerald-400 font-bold cursor-pointer transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{employeeId}</span>
              <span className="text-[10px] text-slate-500 font-normal">({isAdmin ? 'Admin' : 'Personal'})</span>
            </button>

            <button
              onClick={() => { fetchDepartments(); fetchTasksAndTelemetry(); }}
              disabled={loading}
              className="hidden md:flex p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Executive Velocity Digest */}
        {digest && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Executive Department Velocity Digest</span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Completion Velocity: {digest.completion_velocity}
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-center">
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">TOTAL STREAM</span>
                <strong className="text-xl text-white font-bold">{digest.total_tasks}</strong>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-emerald-400 uppercase block font-semibold">VERIFIED COMPLETE</span>
                <strong className="text-xl text-emerald-400 font-bold">{digest.completed}</strong>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-blue-400 uppercase block font-semibold">ACTIVE EXECUTION</span>
                <strong className="text-xl text-blue-400 font-bold">{digest.in_progress}</strong>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-amber-400 uppercase block font-semibold">URGENT QUEUE</span>
                <strong className="text-xl text-amber-400 font-bold">{digest.urgent_queue}</strong>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-rose-400 uppercase block font-semibold">BLOCKED ITEMS</span>
                <strong className="text-xl text-rose-400 font-bold">{digest.blockers_reported}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Real-Time Ping Notice Banner */}
        {unreadPings.length > 0 && (
          <div 
            onClick={() => setShowPingsModal(true)}
            className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between font-mono text-xs text-amber-300 cursor-pointer transition-all shadow-lg"
          >
            <div className="flex items-center space-x-2.5">
              <Bell className="w-4 h-4 text-amber-400 animate-bounce shrink-0" />
              <span><strong>Ping Notice Active:</strong> You have {unreadPings.length} unread priority notice(s). Click to review &amp; dismiss.</span>
            </div>
            <span className="text-[10px] uppercase font-bold bg-amber-500/20 px-2.5 py-1 rounded-lg text-amber-300 flex items-center gap-1 shrink-0">
              <span>Open Drawer</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {isAdmin ? "Enterprise Task Stream" : "My Assigned Work"}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {isAdmin ? `Cross-department execution board for ${tenantStats?.company_name || 'Organization'}.` : "Personal zero-trust task queue and focus lane."}
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end font-mono text-xs">
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center space-x-1 shadow-sm">
              <button
                onClick={() => setViewMode('board')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                  viewMode === 'board' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
                  viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>

            {isAdmin && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Assign</span>
                </button>
                
                <button
                  onClick={() => setShowCsvModal(true)}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 1. EQUAL-HEIGHT BALANCED KANBAN VIEW */}
        {viewMode === 'board' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            
            {/* COLUMN 1: URGENT ASSIGNING */}
            <div className="bg-slate-900/60 border border-rose-500/30 rounded-2xl p-4 flex flex-col h-[580px] shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <span className="font-mono text-xs font-bold text-rose-400 flex items-center gap-1.5 uppercase">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  Urgent Assigning
                </span>
                <span className="text-xs font-mono bg-rose-500/10 text-rose-300 px-2.5 py-0.5 rounded-full font-bold border border-rose-500/20">
                  {urgentTasks.length}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 custom-scrollbar">
                {urgentTasks.map(task => (
                  <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/20 space-y-2 hover:border-rose-500/40 transition-all shadow-md">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{task.dept_id}</span>
                      <span className="text-rose-400 font-bold uppercase">{task.priority}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                    <div className="text-[10px] font-mono text-slate-400 truncate">Assignee: {task.assigned_to}</div>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                      <button 
                        onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                        className="text-[11px] font-mono text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1"
                      >
                        <span>Start Task</span>
                        <span>&rarr;</span>
                      </button>
                    </div>
                  </div>
                ))}
                {urgentTasks.length === 0 && <p className="text-xs text-slate-500 italic py-16 text-center">No urgent tasks queued.</p>}
              </div>
            </div>

            {/* COLUMN 2: TASK PROGRESS */}
            <div className="bg-slate-900/60 border border-blue-500/30 rounded-2xl p-4 flex flex-col h-[580px] shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <span className="font-mono text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  In Progress
                </span>
                <span className="text-xs font-mono bg-blue-500/10 text-blue-300 px-2.5 py-0.5 rounded-full font-bold border border-blue-500/20">
                  {progressTasks.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 custom-scrollbar">
                {progressTasks.map(task => (
                  <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/20 space-y-2 hover:border-blue-500/40 transition-all shadow-md">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{task.dept_id}</span>
                      <span className="text-blue-400 font-bold">{task.priority}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                    <div className="text-[10px] font-mono text-slate-400 truncate">Assignee: {task.assigned_to}</div>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                      <button 
                        onClick={() => setShowBlockerModal(task.task_id)}
                        className="text-[11px] font-mono text-amber-400 hover:text-amber-300"
                      >
                        Flag Blocker
                      </button>
                      <button 
                        onClick={() => handleStatusChange(task.task_id, 'COMPLETE')}
                        className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1"
                      >
                        <span>Finish ✓</span>
                      </button>
                    </div>
                  </div>
                ))}
                {progressTasks.length === 0 && <p className="text-xs text-slate-500 italic py-16 text-center">No tasks in flight.</p>}
              </div>
            </div>

            {/* COLUMN 3: PENDING REVIEW */}
            <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 flex flex-col h-[580px] shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Pending / Blocked
                </span>
                <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-500/20">
                  {pendingTasks.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 custom-scrollbar">
                {pendingTasks.map(task => (
                  <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/20 space-y-2 hover:border-amber-500/40 transition-all shadow-md">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{task.dept_id}</span>
                      <span className="text-slate-400">{task.priority}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-300 leading-snug">{task.title}</h4>
                    <div className="text-[10px] font-mono text-slate-400 truncate">Assignee: {task.assigned_to}</div>
                    <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                      <button 
                        onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                        className="text-[11px] font-mono text-blue-400 hover:text-blue-300 font-bold inline-flex items-center gap-1"
                      >
                        <span>Resume &rarr;</span>
                      </button>
                    </div>
                  </div>
                ))}
                {pendingTasks.length === 0 && <p className="text-xs text-slate-500 italic py-16 text-center">No pending tasks.</p>}
              </div>
            </div>

            {/* COLUMN 4: FINISHED TASK */}
            <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-4 flex flex-col h-[580px] shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Finished Task
                </span>
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20">
                  {completeTasks.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pt-3 pr-1 custom-scrollbar">
                {completeTasks.map(task => (
                  <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/20 space-y-2 opacity-85 hover:opacity-100 transition-all shadow-md">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{task.dept_id}</span>
                      <span className="text-emerald-400 font-bold">COMPLETED</span>
                    </div>
                    <h4 className="text-xs font-medium text-slate-400 line-through leading-snug">{task.title}</h4>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-900">
                      <span>By: {task.assigned_to}</span>
                      <button 
                        onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                        className="text-slate-400 hover:text-slate-200 underline inline-flex items-center gap-0.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reopen</span>
                      </button>
                    </div>
                  </div>
                ))}
                {completeTasks.length === 0 && <p className="text-xs text-slate-500 italic py-16 text-center">No completed tasks yet.</p>}
              </div>
            </div>

          </div>
        )}

        {/* 2. HIGH-DENSITY ENTERPRISE LIST VIEW */}
        {viewMode === 'list' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Task Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Assignee</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {tasks.map(task => (
                    <tr key={task.task_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          task.status === 'URGENT' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          task.status === 'PROGRESS' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                          task.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' :
                          'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-bold">{task.priority}</td>
                      <td className="py-3 px-4 text-white font-sans text-xs font-semibold">{task.title}</td>
                      <td className="py-3 px-4 text-slate-400">{task.dept_id}</td>
                      <td className="py-3 px-4 text-slate-400 truncate max-w-[140px]">{task.assigned_to}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {task.status === 'PROGRESS' && (
                          <button
                            onClick={() => handleStatusChange(task.task_id, 'COMPLETE')}
                            className="text-emerald-400 hover:text-emerald-300 font-bold"
                          >
                            Finish ✓
                          </button>
                        )}
                        {task.status === 'PENDING' && (
                          <button
                            onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                            className="text-blue-400 hover:text-blue-300 font-bold"
                          >
                            Resume &rarr;
                          </button>
                        )}
                        {task.status === 'URGENT' && (
                          <button
                            onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                            className="text-rose-400 hover:text-rose-300 font-bold"
                          >
                            Start &rarr;
                          </button>
                        )}
                        {task.status === 'COMPLETE' && (
                          <button
                            onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                            className="text-slate-400 hover:text-slate-200 underline text-[11px]"
                          >
                            Reopen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500 italic">No tasks found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* MODAL 1: WORKSPACE IDENTITY & TENANT LOGIN */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Switch Enterprise Workspace</span>
              </h3>
              <button onClick={() => setShowLoginModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Enter any global Organization ID or Employee ID (Format: <code>TENANT-DEPT-ROLE-CHECKSUM</code> or <code>ETMAGJUMR62</code>):
            </p>
            <input
              type="text"
              placeholder="e.g. ALPHA-ENG-ADM-99 or ETMAGJUMR62"
              value={customIdInput}
              onChange={(e) => setCustomIdInput(e.target.value.toUpperCase())}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Quick Presets:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setEmployeeId("ETMAGJUMR62"); setShowLoginModal(false); }}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-emerald-400 text-[10px]"
                >
                  ETM Admin
                </button>
                <button
                  onClick={() => { setEmployeeId("ETM-AG-EMP-R62"); setShowLoginModal(false); }}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-sky-400 text-[10px]"
                >
                  ETM Employee
                </button>
                <button
                  onClick={() => { setEmployeeId("ALPHA-OPS-ADM-01"); setShowLoginModal(false); }}
                  className="px-2.5 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-amber-400 text-[10px]"
                >
                  Alpha Corp Admin
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                if (customIdInput.trim()) setEmployeeId(customIdInput.trim());
                setShowLoginModal(false);
                setCustomIdInput('');
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Mount Workspace Session
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD CUSTOM DEPARTMENT */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddDepartment} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-emerald-400" />
                <span>Create Custom Department</span>
              </h3>
              <button type="button" onClick={() => setShowDeptModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Department Code (ID):</label>
              <input
                type="text"
                placeholder="e.g. COMPLIANCE, CARDIOLOGY, LEGAL, GROWTH"
                value={newDeptId}
                onChange={(e) => setNewDeptId(e.target.value.toUpperCase())}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Full Department Name:</label>
              <input
                type="text"
                placeholder="e.g. Regulatory Compliance & Audit"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Add Department to Organization
            </button>
          </form>
        </div>
      )}

      {/* MODAL 3: PING NOTIFICATION DRAWER */}
      {showPingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400">
                <Bell className="w-4 h-4" />
                <h3 className="font-bold text-white text-sm">Active Ping Notices ({unreadPings.length})</h3>
              </div>
              <button onClick={() => setShowPingsModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar">
              {unreadPings.map(ping => (
                <div key={ping.notification_id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-rose-400 font-bold text-[10px]">{ping.type}</span>
                    <span className="text-slate-500 text-[10px]">{new Date(ping.created_at).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{ping.title}</h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{ping.message}</p>
                  <div className="pt-2 text-right">
                    <button
                      onClick={() => handleAcknowledgePing(ping.notification_id)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold"
                    >
                      Mark as Read ✓
                    </button>
                  </div>
                </div>
              ))}
              {unreadPings.length === 0 && (
                <p className="text-slate-500 italic text-center py-6">All pings acknowledged.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: LICENSE ACTIVATION (SME 10-Seat Upgrade) */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleActivateLicense} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-sky-400">
                <Key className="w-4 h-4" />
                <h3 className="font-bold text-white text-sm">Activate Enterprise License Token</h3>
              </div>
              <button type="button" onClick={() => setShowLicenseModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Unlock unlimited corporate seats (&gt;10 seats) by entering your cryptographic SEOSiri License Key:
            </p>
            <input
              type="text"
              placeholder="e.g. PRO_US_company_1818241500_..."
              value={licenseTokenInput}
              onChange={(e) => setLicenseTokenInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            {licenseStatusMsg && (
              <p className="text-emerald-400 text-[11px] font-bold">{licenseStatusMsg}</p>
            )}
            <div className="flex items-center justify-between pt-2">
              <a 
                href="https://developers.seosiri.com/#key-issuer" 
                target="_blank" 
                rel="noreferrer"
                className="text-slate-400 hover:underline text-[10px]"
              >
                Purchase via Payoneer &rarr;
              </a>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all"
              >
                Activate Token
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 5: SINGLE TASK ASSIGNMENT */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAssignSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Assign Task</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Task Title:</label>
              <input 
                type="text" 
                value={newTaskTitle} 
                onChange={(e) => setNewTaskTitle(e.target.value)} 
                placeholder="e.g. Audit Q4 Compliance Report"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Assignee Employee ID:</label>
              <input 
                type="text" 
                value={newTaskAssignee} 
                onChange={(e) => setNewTaskAssignee(e.target.value)} 
                placeholder="Leave blank to assign to self"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Department:</label>
                <select 
                  value={newTaskDept} 
                  onChange={(e) => setNewTaskDept(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  {departments.map(d => (
                    <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Priority:</label>
                <select 
                  value={newTaskPriority} 
                  onChange={(e) => setNewTaskPriority(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
            </div>
            <label className="flex items-center space-x-2 text-slate-300 cursor-pointer pt-1">
              <input 
                type="checkbox" 
                checked={newTaskUrgent} 
                onChange={(e) => setNewTaskUrgent(e.target.checked)} 
              />
              <span>Route immediately to <strong>Urgent Assigning</strong> (Ping Alert)</span>
            </label>
            <button 
              type="submit" 
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Inject Task into Pipeline
            </button>
          </form>
        </div>
      )}

      {/* MODAL 6: BULK CSV INGESTION */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">Bulk CSV / Spreadsheet Ingestion</h3>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Format: <code>title,assignedTo,deptId,priority,isUrgent</code>
            </p>
            <textarea
              rows={6}
              value={rawCsvText}
              onChange={(e) => setRawCsvText(e.target.value)}
              placeholder="title,assignedTo,deptId,priority,isUrgent&#10;Audit ISO Compliance,EMP_01,OPERATIONS,HIGH,true&#10;Verify Treasury Records,EMP_02,FINANCE,MEDIUM,false"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 font-mono text-[11px]"
            />
            <button
              onClick={handleBulkCsvSubmit}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Execute Ingestion Batch
            </button>
          </div>
        </div>
      )}

      {/* MODAL 7: REPORT BLOCKER */}
      {showBlockerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-amber-400">Flag Blocker on Task</h3>
              <button onClick={() => setShowBlockerModal(null)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <textarea
              rows={3}
              value={blockerText}
              onChange={(e) => setBlockerText(e.target.value)}
              placeholder="Explain dependency blocker (e.g. Awaiting client contract approval)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => {
                handleStatusChange(showBlockerModal, 'PENDING', blockerText);
                setShowBlockerModal(null);
                setBlockerText('');
              }}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-md"
            >
              Escalate Blocker Notice to Management
            </button>
          </div>
        </div>
      )}

      {/* Universal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center font-mono text-[11px] text-slate-500">
        &copy; {new Date().getFullYear()} SEOSiri Enterprise Labs • Tasks Sentinel Global Infrastructure
      </footer>

    </div>
  );
}
