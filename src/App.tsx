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
  Check,
  ChevronRight,
  Sparkles
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
  const [employeeId, setEmployeeId] = useState('ETMAGJUMR62');
  const [isAdmin, setIsAdmin] = useState(true);
  const [selectedDept, setSelectedDept] = useState('ALL');
  
  // Data States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [tenantStats, setTenantStats] = useState<TenantStats | null>(null);
  const [unreadPings, setUnreadPings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showPingsModal, setShowPingsModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showBlockerModal, setShowBlockerModal] = useState<string | null>(null);
  
  // Form Inputs
  const [blockerText, setBlockerText] = useState('');
  const [licenseTokenInput, setLicenseTokenInput] = useState('');
  const [licenseStatusMsg, setLicenseStatusMsg] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('ETM-AG-EMP-R62');
  const [newTaskDept, setNewTaskDept] = useState('AG');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [newTaskUrgent, setNewTaskUrgent] = useState(false);
  const [rawCsvText, setRawCsvText] = useState('');

  const fetchTasksAndTelemetry = async () => {
    setLoading(true);
    try {
      // 1. Fetch Tasks (with optional dept filter)
      const deptQuery = selectedDept !== 'ALL' ? `?dept=${selectedDept}` : '';
      const res = await fetch(`${API_GATEWAY}/v1/tasks${deptQuery}`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
        setIsAdmin(data.role === 'ADMIN');
      }

      // 2. Fetch Notifications / Pings
      const pingRes = await fetch(`${API_GATEWAY}/v1/notifications/ping`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const pingData = await pingRes.json();
      if (pingData.notifications) {
        setUnreadPings(pingData.notifications);
      }

      // 3. Fetch Tenant Stats (Seats & Tier)
      const statsRes = await fetch(`${API_GATEWAY}/v1/tenants/stats`, {
        headers: { "X-Employee-ID": employeeId }
      });
      const statsData = await statsRes.json();
      if (statsData.tenant_id) {
        setTenantStats(statsData);
      }

      // 4. Fetch Digest (Admin only)
      if (data.role === 'ADMIN' || data.role === 'DEPT_HEAD') {
        const digRes = await fetch(`${API_GATEWAY}/v1/analytics/digest`, {
          headers: { "X-Employee-ID": employeeId }
        });
        const digData = await digRes.json();
        if (digData.digest) {
          setDigest(digData.digest);
        }
      } else {
        setDigest(null);
      }
    } catch (err) {
      console.error("Gateway Sync Error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksAndTelemetry();
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
      if (json.status === "TRANSITION_LOGGED") {
        setStatusMessage(`Task transitioned to ${newStatus}`);
        setTimeout(() => setStatusMessage(''), 3000);
        fetchTasksAndTelemetry();
      }
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
        setLicenseStatusMsg(`Tier upgraded to ${json.tier} (${json.max_seats} Seats)!`);
        setTimeout(() => {
          setShowLicenseModal(false);
          setLicenseStatusMsg('');
          fetchTasksAndTelemetry();
        }, 2000);
      } else {
        setLicenseStatusMsg(json.message || "Activation Failed.");
      }
    } catch (err) {
      setLicenseStatusMsg("Error connecting to edge gateway.");
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
          assignedTo: newTaskAssignee,
          deptId: newTaskDept,
          priority: newTaskPriority,
          isUrgent: newTaskUrgent
        })
      });
      const data = await res.json();
      if (data.status === "ASSIGNED") {
        setShowAssignModal(false);
        setNewTaskTitle('');
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
        title: title || "Untitled Bulk Task",
        assignedTo: assignedTo || employeeId,
        deptId: deptId || "AG",
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
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      
      {/* Control Header */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-6 py-4 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 p-0.5 flex items-center justify-center font-bold text-white shadow-lg">
              S
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>SEOSiri Task Sentinel</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Global Enterprise Board
                </span>
              </h1>
              <span className="text-xs text-slate-400 font-mono">Gateway: tasks.seosiri.com</span>
            </div>
          </div>

          {/* Seat Status & Control Badges */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            {tenantStats && (
              <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="text-slate-400">Seats:</span>
                <strong className={tenantStats.active_seats >= tenantStats.max_seats ? "text-rose-400" : "text-emerald-400"}>
                  {tenantStats.active_seats} / {tenantStats.max_seats}
                </strong>
                <span className="text-[10px] text-slate-500">({tenantStats.tier})</span>
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

            {/* Department Filter (Admin View) */}
            {isAdmin && (
              <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select 
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="bg-transparent text-slate-200 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="ALL">All Departments</option>
                  <option value="AG">AG (Core Architecture)</option>
                  <option value="ENG">ENG (Engineering)</option>
                  <option value="OPS">OPS (Operations)</option>
                  <option value="BIOPHARMA">BIOPHARMA (Life Sciences)</option>
                </select>
              </div>
            )}

            {/* Identity Switcher */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 flex items-center space-x-2">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <select 
                value={employeeId} 
                onChange={(e) => setEmployeeId(e.target.value)}
                className="bg-transparent text-emerald-400 font-bold focus:outline-none cursor-pointer"
              >
                <option value="ETMAGJUMR62">ETMAGJUMR62 (Admin Global View)</option>
                <option value="ETM-AG-EMP-R62">ETM-AG-EMP-R62 (Employee Isolated View)</option>
              </select>
            </div>

            <button
              onClick={fetchTasksAndTelemetry}
              disabled={loading}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
          </div>

        </div>
      </header>

      {/* Main Board Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* Executive Digest */}
        {digest && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Executive Department Velocity Digest</span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Velocity: {digest.completion_velocity}
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-center">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">TOTAL TASKS</span>
                <strong className="text-lg text-white font-bold">{digest.total_tasks}</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-emerald-500 block">FINISHED TASK</span>
                <strong className="text-lg text-emerald-400 font-bold">{digest.completed}</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-blue-500 block">IN PROGRESS</span>
                <strong className="text-lg text-blue-400 font-bold">{digest.in_progress}</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-amber-500 block">URGENT QUEUE</span>
                <strong className="text-lg text-amber-400 font-bold">{digest.urgent_queue}</strong>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-rose-500 block">FLAGGED BLOCKERS</span>
                <strong className="text-lg text-rose-400 font-bold">{digest.blockers_reported}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Ping Notice Alert Bar */}
        {unreadPings.length > 0 && (
          <div 
            onClick={() => setShowPingsModal(true)}
            className="bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 rounded-xl p-3.5 flex items-center justify-between font-mono text-xs text-amber-300 cursor-pointer transition-all shadow-lg"
          >
            <div className="flex items-center space-x-2.5">
              <Bell className="w-4 h-4 text-amber-400 animate-bounce" />
              <span><strong>Ping Notice Active:</strong> You have {unreadPings.length} unread priority notice(s). Click to review &amp; dismiss.</span>
            </div>
            <span className="text-[10px] uppercase font-bold bg-amber-500/20 px-2 py-1 rounded text-amber-300 flex items-center gap-1">
              <span>Open Ping Drawer</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        )}

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isAdmin ? "Enterprise Task Stream (Global View)" : "Individual Assigned Workflow"}
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {isAdmin ? "Global multi-department pipeline & velocity oversight." : "Zero-trust isolated personal queue."}
            </p>
          </div>

          {isAdmin && (
            <div className="flex items-center space-x-2 font-mono text-xs">
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Assign Task</span>
              </button>
              
              <button
                onClick={() => setShowCsvModal(true)}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Bulk CSV Import</span>
              </button>
            </div>
          )}
        </div>

        {/* 4-COLUMN KANBAN PIPELINE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          
          {/* 1. URGENT ASSIGNING */}
          <div className="bg-slate-900/60 border border-rose-500/30 rounded-2xl p-4 flex flex-col h-[calc(100vh-330px)] min-h-[480px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-mono text-xs font-bold text-rose-400 flex items-center gap-1.5 uppercase">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Urgent Assigning
              </span>
              <span className="text-xs font-mono bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                {urgentTasks.length}
              </span>
            </div>
            
            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 kanban-scroll">
              {urgentTasks.map(task => (
                <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/20 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">{task.dept_id}</span>
                    <span className="text-rose-400 font-bold uppercase">{task.priority}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                  <div className="text-[10px] font-mono text-slate-500 truncate">To: {task.assigned_to}</div>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                    <button 
                      onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                      className="text-[11px] font-mono text-blue-400 hover:underline font-bold"
                    >
                      Start Task &rarr;
                    </button>
                  </div>
                </div>
              ))}
              {urgentTasks.length === 0 && <p className="text-xs text-slate-500 italic py-4 text-center">No urgent tasks queued.</p>}
            </div>
          </div>

          {/* 2. TASK PROGRESS */}
          <div className="bg-slate-900/60 border border-blue-500/30 rounded-2xl p-4 flex flex-col h-[calc(100vh-330px)] min-h-[480px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-mono text-xs font-bold text-blue-400 flex items-center gap-1.5 uppercase">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                Task Progress
              </span>
              <span className="text-xs font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                {progressTasks.length}
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 kanban-scroll">
              {progressTasks.map(task => (
                <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-blue-500/20 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">{task.dept_id}</span>
                    <span className="text-blue-400 font-bold">{task.priority}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white leading-snug">{task.title}</h4>
                  <div className="text-[10px] font-mono text-slate-500 truncate">To: {task.assigned_to}</div>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                    <button 
                      onClick={() => setShowBlockerModal(task.task_id)}
                      className="text-[11px] font-mono text-amber-400 hover:underline"
                    >
                      Flag Blocker
                    </button>
                    <button 
                      onClick={() => handleStatusChange(task.task_id, 'COMPLETE')}
                      className="text-[11px] font-mono text-emerald-400 hover:underline font-bold"
                    >
                      Finish &check;
                    </button>
                  </div>
                </div>
              ))}
              {progressTasks.length === 0 && <p className="text-xs text-slate-500 italic py-4 text-center">No tasks in flight.</p>}
            </div>
          </div>

          {/* 3. PENDING */}
          <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-4 flex flex-col h-[calc(100vh-330px)] min-h-[480px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-mono text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Pending Review
              </span>
              <span className="text-xs font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                {pendingTasks.length}
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 kanban-scroll">
              {pendingTasks.map(task => (
                <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/20 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">{task.dept_id}</span>
                    <span className="text-slate-400">{task.priority}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-300 leading-snug">{task.title}</h4>
                  <div className="text-[10px] font-mono text-slate-500 truncate">To: {task.assigned_to}</div>
                  <div className="pt-2 flex items-center justify-between border-t border-slate-900">
                    <button 
                      onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                      className="text-[11px] font-mono text-blue-400 hover:underline font-bold"
                    >
                      Resume &rarr;
                    </button>
                  </div>
                </div>
              ))}
              {pendingTasks.length === 0 && <p className="text-xs text-slate-500 italic py-4 text-center">No pending tasks.</p>}
            </div>
          </div>

          {/* 4. FINISHED TASK / COMPLETE */}
          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-4 flex flex-col h-[calc(100vh-330px)] min-h-[480px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-mono text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Finished Task
              </span>
              <span className="text-xs font-mono bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                {completeTasks.length}
              </span>
            </div>

            <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 kanban-scroll">
              {completeTasks.map(task => (
                <div key={task.task_id} className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/20 space-y-1.5 opacity-85">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">{task.dept_id}</span>
                    <span className="text-emerald-400 font-bold">RESOLVED</span>
                  </div>
                  <h4 className="text-xs font-medium text-slate-400 line-through leading-snug">{task.title}</h4>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 pt-1">
                    <span>By: {task.assigned_to}</span>
                    <button 
                      onClick={() => handleStatusChange(task.task_id, 'PROGRESS')}
                      className="text-slate-500 hover:text-slate-300 underline"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              ))}
              {completeTasks.length === 0 && <p className="text-xs text-slate-500 italic py-4 text-center">No completed tasks yet.</p>}
            </div>
          </div>

        </div>

      </main>

      {/* PING NOTIFICATION DRAWER / MODAL */}
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

            <div className="space-y-2.5 max-h-80 overflow-y-auto">
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
                      Mark as Read &check;
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

      {/* LICENSE ACTIVATION MODAL (SME 10-Seat Upgrade) */}
      {showLicenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleActivateLicense} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-2 text-sky-400">
                <Key className="w-4 h-4" />
                <h3 className="font-bold text-white text-sm">Activate SEOSiri License Token</h3>
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
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

      {/* MODAL: SINGLE TASK ASSIGNMENT */}
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
                placeholder="e.g. Verify DNS SOA Expire parameter"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Assignee Employee ID:</label>
              <input 
                type="text" 
                value={newTaskAssignee} 
                onChange={(e) => setNewTaskAssignee(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Department:</label>
                <input 
                  type="text" 
                  value={newTaskDept} 
                  onChange={(e) => setNewTaskDept(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
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
              <span>Route immediately to <strong>Urgent Tasks Assigning</strong> (Ping Alert)</span>
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

      {/* MODAL: BULK CSV INGESTION */}
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
              placeholder="title,assignedTo,deptId,priority,isUrgent&#10;Audit HL7 FHIR Bridge,ETM-AG-EMP-R62,AG,HIGH,true&#10;Verify Cloudflare WAF,ETM-AG-EMP-R62,AG,MEDIUM,false"
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

      {/* MODAL: REPORT BLOCKER */}
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
              placeholder="Explain blocker (e.g. Missing AWS S3 IAM credentials)..."
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

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center font-mono text-[11px] text-slate-500">
        &copy; {new Date().getFullYear()} SEOSiri Enterprise Labs • Tasks Sentinel Global Infrastructure
      </footer>

    </div>
  );
}
