import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  FolderKanban,
  Gauge,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';

const sidebarItems = [
  { label: 'Dashboard', icon: LayoutGrid, active: true },
  { label: 'Claims Board', icon: FolderKanban },
  { label: 'Intimations', icon: ClipboardList },
  { label: 'Policy Data', icon: FileText },
  { label: 'Assessments', icon: Gauge },
  { label: 'Payments', icon: Activity },
  { label: 'Team', icon: Users },
  { label: 'Settings', icon: Settings },
];

const kpis = [
  { label: 'MY OPEN CLAIMS', value: '48', trend: '▲ 6 vs last week', trendUp: true },
  { label: 'NEW INTIMATIONS', value: '12', trend: '▼ 2 vs last week', trendUp: false },
  { label: 'TODAY', value: '9', status: 'Pending', statusTone: 'amber' },
  { label: 'INSPECTION', value: '5', status: 'Pending', statusTone: 'amber' },
  { label: 'APPROVAL', value: '3', status: 'SLA Breached', statusTone: 'red' },
  { label: 'DUE TODAY', value: '8' },
];

const alerts = [
  'Surveyor appointment TAT alert',
  'Kothari Hyundai estimate reminder',
  'Delayed claim intimation alert',
  'Reserve revision alert',
  'Possible duplicate claim alert',
];

const diary = [
  { time: '11:30', task: 'Call Kothari Hyundai for estimate' },
  { time: '14:00', task: 'Review salvage quote' },
  { time: '16:15', task: 'Collect HDFC Bank NOC' },
];

const stageData = [
  { label: 'Intimation', value: 12, color: '#005F56' },
  { label: 'Registered', value: 8, color: '#2DD4BF' },
  { label: 'Survey', value: 9, color: '#7DD3FC' },
  { label: 'Assessment', value: 11, color: '#93C5FD' },
  { label: 'Approval', value: 8, color: '#FCD34D' },
  { label: 'Repair', value: 5, color: '#F59E0B' },
  { label: 'Payment', value: 7, color: '#FB7185' },
  { label: 'Closed', value: 0, color: '#E2E8F0' },
];

const agingData = [
  { label: '0–7 days', value: 26, percent: '54%' },
  { label: '8–15 days', value: 14, percent: '29%' },
  { label: '16–30 days', value: 5, percent: '10%' },
  { label: '31–60 days', value: 2, percent: '4%' },
  { label: '60+ days', value: 1, percent: '2%' },
];

const recentClaims = [
  { claimId: 'CLM-260184', policyholder: 'Arjun Kumar', vehicle: 'TN 09 AB 4321', status: 'Under Review', statusTone: 'amber', updated: '12 Oct 2026', stage: 'Survey', priority: 'High', priorityTone: 'red' },
  { claimId: 'CLM-260179', policyholder: 'Priya S', vehicle: 'TN 37 CD 1182', status: 'Survey Pending', statusTone: 'sky', updated: '12 Oct 2026', stage: 'Assessment', priority: 'Medium', priorityTone: 'amber' },
  { claimId: 'CLM-260166', policyholder: 'Rahman M', vehicle: 'TN 38 EF 9021', status: 'Approved', statusTone: 'green', updated: '11 Oct 2026', stage: 'Repair', priority: 'Low', priorityTone: 'green' },
  { claimId: 'CLM-260151', policyholder: 'Divya R', vehicle: 'TN 10 GH 6543', status: 'Registered', statusTone: 'teal', updated: '11 Oct 2026', stage: 'Intimation', priority: 'Low', priorityTone: 'green' },
];

const SMALL_STATUS_CLASSES = {
  amber: 'bg-[#FFF7E6] text-[#B7791F] border-[#F6D59D]',
  red: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FCA5A5]',
  green: 'bg-[#E6FFFB] text-[#005F56] border-[#9AE6D5]',
  sky: 'bg-[#E0F2FE] text-[#0F4C81] border-[#BAE6FD]',
  teal: 'bg-[#DFFAF6] text-[#005F56] border-[#A7F3D0]',
};

const PRIORITY_CLASSES = {
  red: 'bg-[#FEE2E2] text-[#B91C1C]',
  amber: 'bg-[#FEF3C7] text-[#B45309]',
  green: 'bg-[#E6FFFB] text-[#005F56]',
};

const ODDashboard = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const donutSegments = useMemo(() => {
    const values = [82, 11, 7];
    const total = values.reduce((sum, value) => sum + value, 0);
    let start = 0;
    return values.map((value, index) => {
      const segment = {
        start,
        end: start + (value / total) * 100,
        color: index === 0 ? '#005F56' : index === 1 ? '#C7F9F2' : '#E2E8F0',
      };
      start = segment.end;
      return segment;
    });
  }, []);

  const handleDemoAction = (message) => {
    setToast(message);
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  };

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[#F7F9FB] text-slate-900">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-800/70 bg-[#081521] px-3 py-4 text-slate-100">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A2336] text-[#2DD4BF] shadow-[0_0_18px_rgba(45,212,191,0.2)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2DD4BF]">Smart Claims</div>
            <div className="text-[11px] text-slate-400">Claims Hub</div>
          </div>
        </div>

        <nav className="space-y-1">
          {sidebarItems.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              type="button"
              onClick={() => handleDemoAction(`${label} demo view opened.`)}
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition ${
                active ? 'bg-[#0E1F31] text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.2)]' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[#2DD4BF]' : 'text-slate-400'}`} />
              <span className="font-medium">{label}</span>
              {active && <span className="ml-auto h-2 w-2 rounded-full bg-[#2DD4BF]" aria-hidden="true" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-white/10 bg-[#0E1F31] p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Coverage</p>
          <p className="mt-2 text-lg font-semibold text-white">92.4%</p>
          <div className="mt-3 h-2 rounded-full bg-white/5">
            <div className="h-2 w-[92.4%] rounded-full bg-[#2DD4BF]" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E6FFFB] text-[#005F56] shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#005F56]">Smart Claims</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Motor OD Claims</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSearchOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              {searchOpen && (
                <div className="absolute right-0 top-12 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <Search className="h-3.5 w-3.5 text-slate-500" />
                    <input
                      className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                      placeholder="Search claims"
                      defaultValue="CLM-260184"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationOpen((value) => !value)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#005F56]" />
              </button>
              {notificationOpen && (
                <div className="absolute right-0 top-12 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alerts</p>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {['Surveyor appointment TAT alert', 'Reserve revision alert', 'Duplicate claim flagged'].map((item) => (
                      <li key={item} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-2">
                        <CircleAlert className="mt-0.5 h-4 w-4 text-[#005F56]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleDemoAction('Activity feed demo opened.')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Recent activity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((value) => !value)}
                className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-1.5 pr-3 text-left transition hover:border-slate-300"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DFFAF6] text-[#005F56]">
                  <User className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-slate-800">Priya Sharma</div>
                  <div className="text-[11px] text-slate-500">Claims Handler – Pune Hub</div>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 top-14 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Profile</button>
                  <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Preferences</button>
                  <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden px-3 py-2">
          <div className="mb-2 grid grid-cols-[repeat(6,minmax(0,1fr))_auto] items-stretch gap-[10px]">
            {kpis.map(({ label, value, trend, status, statusTone, trendUp }) => (
              <div
                key={label}
                className="flex h-[90px] min-w-0 flex-col justify-between rounded-[12px] border border-slate-200 bg-white px-3 py-2 shadow-[0_3px_10px_rgba(15,23,42,0.04)]"
              >
                <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                <div className="flex items-end justify-between gap-2">
                  <span className="translate-y-[-1px] text-[24px] font-bold leading-none tracking-[-0.05em] text-slate-900">{value}</span>
                  {(trend || status) && (
                    <span
                      className={`ml-auto inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                        trend
                          ? trendUp
                            ? 'border-[#B7F2E9] bg-[#E6FFFB] text-[#005F56]'
                            : 'border-[#F9D7D7] bg-[#FEE2E2] text-[#B91C1C]'
                          : SMALL_STATUS_CLASSES[statusTone]
                      }`}
                    >
                      {trend || status}
                    </span>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => handleDemoAction('Demo interaction: New claim registration would open here.')}
              className="flex h-[90px] items-center justify-center gap-2 rounded-[12px] bg-[#005F56] px-3 text-[14px] font-semibold text-white shadow-[0_10px_18px_rgba(0,95,86,0.18)] transition hover:bg-[#004E46]"
            >
              <Plus className="h-4 w-4" />
              <span>New Claim</span>
            </button>
          </div>

          <div className="grid grid-cols-[1.15fr_1.4fr_1.1fr] gap-[10px]">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">SLA & TAT Health</p>
                  <p className="mt-1 text-[12px] text-slate-500">Target &gt;80%</p>
                </div>
                <div className="rounded-full bg-[#E6FFFB] px-2 py-1 text-[10px] font-semibold text-[#005F56]">82%</div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="relative flex h-20 w-20 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${donutSegments.map((segment) => `${segment.color} ${segment.start}% ${segment.end}%`).join(', ')})`,
                  }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[14px] font-bold text-slate-900">82%</div>
                </div>
                <div className="flex-1 space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between"><span className="text-slate-500">Within SLA</span><span className="font-semibold text-slate-800">82%</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">At risk</span><span className="font-semibold text-slate-800">11%</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Breached</span><span className="font-semibold text-slate-800">7%</span></div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Alerts & Nudges</p>
                  <p className="mt-1 text-[12px] text-slate-500">4 Actions</p>
                </div>
                <button type="button" onClick={() => handleDemoAction('Alerts center opened.')} className="text-[11px] font-semibold text-[#005F56]">View all</button>
              </div>

              <ul className="space-y-2 text-[12px] text-slate-700">
                {alerts.map((alert) => (
                  <li key={alert} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#005F56]" aria-hidden="true" />
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Today's Diary</p>
                  <p className="mt-1 text-[12px] text-slate-500">3 pending</p>
                </div>
                <button type="button" onClick={() => handleDemoAction('Task composer opened.')} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">Add task</button>
              </div>

              <ul className="space-y-2 text-[12px] text-slate-700">
                {diary.map(({ time, task }) => (
                  <li key={time} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <div className="w-12 shrink-0 text-[11px] font-semibold text-[#005F56]">{time}</div>
                    <div className="flex-1 text-slate-700">{task}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-[1.2fr_1.1fr_1.15fr_1.2fr] gap-[10px]">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Claims by Stage</p>
              <div className="mt-2 grid h-[104px] grid-cols-8 items-end gap-1.5">
                {stageData.map(({ label, value, color }) => (
                  <div key={label} className="flex h-full flex-col items-center justify-end gap-2">
                    <div className="flex h-full w-full items-end justify-center">
                      <div
                        className="w-full rounded-t-md"
                        style={{ height: `${Math.max((value / 12) * 100, value === 0 ? 6 : 16)}%`, background: color }}
                        title={`${label}: ${value}`}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">{value || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                {stageData.map(({ label, color }) => (
                  <div key={label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Ageing Buckets</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[conic-gradient(#005F56_0_54%,#2DD4BF_54%_83%,#7DD3FC_83%_93%,#E2E8F0_93%_100%)]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[13px] font-bold text-slate-800">48</div>
                </div>
                <div className="flex-1 space-y-1.5 text-[11px] text-slate-600">
                  {agingData.map(({ label, percent }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      <span className="font-semibold text-slate-800">{percent}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Average Cycle TAT</p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-[28px] font-bold tracking-[-0.05em] text-slate-900">4.2</div>
                  <div className="mt-1 text-[11px] text-slate-500">days</div>
                </div>
                <div className="rounded-full bg-[#E6FFFB] px-2 py-1 text-[10px] font-semibold text-[#005F56]">Standard: 5.0 days</div>
              </div>
              <div className="mt-3 h-20 rounded-xl bg-slate-50 p-2">
                <div className="relative h-full w-full overflow-hidden rounded-lg">
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#DFFAF6] to-transparent" />
                  <div className="absolute bottom-0 left-0 h-2/3 w-[18%] rounded-t-md bg-[#005F56]" />
                  <div className="absolute bottom-0 left-[22%] h-1/2 w-[18%] rounded-t-md bg-[#2DD4BF]" />
                  <div className="absolute bottom-0 left-[44%] h-2/3 w-[18%] rounded-t-md bg-[#7DD3FC]" />
                  <div className="absolute bottom-0 left-[66%] h-3/5 w-[18%] rounded-t-md bg-[#C7F9F2]" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
              <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Priority Tasks</p>
              <ul className="mt-3 space-y-2 text-[12px]">
                {[
                  { task: 'Review survey report', id: 'CLM-260179', due: 'Due Today' },
                  { task: 'Approve repair estimate', id: 'CLM-260166', due: 'Due Today' },
                  { task: 'Verify policy documents', id: 'CLM-260184', due: 'Due Tomorrow' },
                ].map(({ task, id, due }) => (
                  <li key={id} className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
                    <Clock3 className="mt-0.5 h-4 w-4 text-[#005F56]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-slate-800">{task}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{due}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{id}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_3px_10px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <div>
                <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Claims</p>
              </div>
              <button type="button" onClick={() => handleDemoAction('Recent claims view expanded.')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#005F56]">
                View all <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden">
              <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Claim ID</th>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Policyholder</th>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Vehicle No.</th>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Claim Status</th>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Updated</th>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Stage</th>
                    <th className="px-2.5 py-2 text-[11px] font-semibold">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClaims.map(({ claimId, policyholder, vehicle, status, statusTone, updated, stage, priority, priorityTone }) => (
                    <tr key={claimId} className="border-t border-slate-200 text-slate-700 hover:bg-slate-50">
                      <td className="border-t border-slate-200 px-2.5 py-2 font-semibold text-[#005F56]">{claimId}</td>
                      <td className="border-t border-slate-200 px-2.5 py-2">{policyholder}</td>
                      <td className="border-t border-slate-200 px-2.5 py-2">{vehicle}</td>
                      <td className="border-t border-slate-200 px-2.5 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${SMALL_STATUS_CLASSES[statusTone]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="border-t border-slate-200 px-2.5 py-2 text-slate-600">{updated}</td>
                      <td className="border-t border-slate-200 px-2.5 py-2 text-slate-600">{stage}</td>
                      <td className="border-t border-slate-200 px-2.5 py-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${PRIORITY_CLASSES[priorityTone]}`}>
                          {priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {toast && (
        <div className="absolute bottom-5 right-5 rounded-xl border border-[#B7F2E9] bg-[#E6FFFB] px-4 py-2 text-sm font-medium text-[#005F56] shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default ODDashboard;

