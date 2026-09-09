import { useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  Users,
  WalletCards,
  X,
} from 'lucide-react';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Students', icon: Users },
  { label: 'Attendance', icon: ClipboardCheck },
  { label: 'Timetable', icon: CalendarDays },
  { label: 'Fees', icon: WalletCards },
  { label: 'Announcements', icon: Bell },
  { label: 'Settings', icon: Settings },
];

const defaultStats = [
  { label: 'Total Students', value: '2,480', trend: '+5.2%', tone: 'indigo', icon: Users },
  { label: 'Attendance Rate', value: '87.4%', trend: '+2.1%', tone: 'emerald', icon: ClipboardCheck },
  { label: 'Pending Assignments', value: '126', trend: '-8.4%', tone: 'amber', icon: BookOpen },
  { label: 'Upcoming Exams', value: '08', trend: '+2 this week', tone: 'rose', icon: CalendarDays },
];

const defaultSchedule = [
  { time: '09:00 AM', title: 'Advanced Mathematics', room: 'Room 204 · Dr. Sarah Wilson', status: 'Completed', tone: 'slate' },
  { time: '11:00 AM', title: 'Data Structures & Algorithms', room: 'Lab 03 · Prof. Michael Chen', status: 'Ongoing', tone: 'indigo' },
  { time: '01:30 PM', title: 'Database Management', room: 'Room 118 · Dr. Olivia Martin', status: 'Upcoming', tone: 'amber' },
  { time: '03:30 PM', title: 'Software Engineering', room: 'Room 301 · Prof. James Lee', status: 'Upcoming', tone: 'amber' },
];

const defaultAssignments = [
  { title: 'Operating Systems Case Study', course: 'Computer Science · CS401', due: 'Today, 5:00 PM', submissions: '42 / 48', status: 'Pending' },
  { title: 'Linear Algebra Problem Set', course: 'Mathematics · MA202', due: 'Tomorrow', submissions: '48 / 48', status: 'Submitted' },
  { title: 'Database Schema Design', course: 'Computer Science · CS305', due: '18 Oct 2024', submissions: '36 / 40', status: 'Graded' },
  { title: 'Research Methodology Review', course: 'Humanities · HM110', due: '21 Oct 2024', submissions: '29 / 45', status: 'Pending' },
];

const defaultNotices = [
  { category: 'Urgent', title: 'Mid-semester examination schedule published', date: 'Today, 10:20 AM', tone: 'rose' },
  { category: 'Academic', title: 'Faculty development workshop registrations open', date: 'Yesterday', tone: 'indigo' },
  { category: 'Sports', title: 'Inter-college athletics trials this Friday', date: '16 Oct 2024', tone: 'emerald' },
];

const toneClasses = {
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function Badge({ children, tone = 'slate' }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>{children}</span>;
}

function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-lg p-2.5 ${toneClasses[stat.tone]}`}><Icon size={19} strokeWidth={2} /></div>
        <button type="button" aria-label={`More options for ${stat.label}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><MoreHorizontal size={18} /></button>
      </div>
      <p className="mt-5 text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <strong className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{stat.value}</strong>
        <span className={`text-xs font-semibold ${stat.trend.startsWith('-') ? 'text-emerald-600' : 'text-indigo-600 dark:text-indigo-300'}`}>{stat.trend}</span>
      </div>
    </article>
  );
}

export default function CampusFlowDashboard({
  stats = defaultStats,
  schedule = defaultSchedule,
  assignments = defaultAssignments,
  notices = defaultNotices,
  attendance = 87.4,
  user = { name: 'Alex Morgan', role: 'Administrator', initials: 'AM' },
}) {
  const [activePage, setActivePage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredAssignments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return assignments;
    return assignments.filter((item) => `${item.title} ${item.course} ${item.status}`.toLowerCase().includes(normalized));
  }, [assignments, query]);

  const closeMobileNav = () => setSidebarOpen(false);

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <div className="flex min-h-screen">
          {sidebarOpen && <button aria-label="Close navigation" onClick={closeMobileNav} className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" />}

          <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-slate-800 text-slate-300 shadow-xl transition-transform duration-200 dark:bg-slate-900 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-20' : 'lg:w-72'}`}>
            <div className="flex h-20 items-center justify-between border-b border-slate-700 px-5">
              <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'lg:mx-auto' : ''}`}>
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-500/25">C</div>
                <span className={`whitespace-nowrap text-lg font-bold tracking-tight text-white ${collapsed ? 'lg:hidden' : ''}`}>CampusFlow</span>
              </div>
              <button type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="hidden rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white lg:block">
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button type="button" onClick={closeMobileNav} aria-label="Close navigation" className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 lg:hidden"><X size={19} /></button>
            </div>

            <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-6">
              <p className={`mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500 ${collapsed ? 'lg:hidden' : ''}`}>Workspace</p>
              {navigation.map(({ label, icon: Icon }) => {
                const active = activePage === label;
                return (
                  <button key={label} type="button" onClick={() => { setActivePage(label); closeMobileNav(); }} title={collapsed ? label : undefined} className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'} ${collapsed ? 'lg:justify-center' : ''}`}>
                    <Icon size={18} className="shrink-0" />
                    <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
                    {label === 'Announcements' && <span className={`ml-auto size-2 rounded-full bg-rose-400 ${collapsed ? 'lg:hidden' : ''}`} />}
                  </button>
                );
              })}
            </nav>

            <div className={`border-t border-slate-700 p-3 ${collapsed ? 'lg:px-2' : ''}`}>
              <button type="button" title={collapsed ? user.name : undefined} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-700 ${collapsed ? 'lg:justify-center' : ''}`}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{user.initials}</span>
                <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}><strong className="block truncate text-sm text-white">{user.name}</strong><small className="block truncate text-xs text-slate-400">{user.role}</small></span>
                <ChevronRight size={16} className={`ml-auto text-slate-500 ${collapsed ? 'lg:hidden' : ''}`} />
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"><Menu size={21} /></button>
                <div className="hidden text-sm text-slate-400 sm:block">Workspace <span className="mx-2">/</span> <strong className="text-slate-700 dark:text-slate-200">{activePage}</strong></div>
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                <label className="hidden w-56 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-400 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 md:flex dark:border-slate-700 dark:bg-slate-800 dark:focus-within:ring-indigo-900">
                  <Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assignments..." className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white" />
                </label>
                <button type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
                <button type="button" aria-label="Notifications" className="relative rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Bell size={19} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" /></button>
                <div className="relative">
                  <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><span className="grid size-9 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{user.initials}</span><ChevronDown size={15} className="hidden text-slate-400 sm:block" /></button>
                  {profileOpen && <div className="absolute right-0 top-12 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Profile</button><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Sign out</button></div>}
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-7 md:px-8 lg:px-10">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">Tuesday, 15 October 2024</p><h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">Good morning, {user.name.split(' ')[0]}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Here is what is happening across your campus today.</p></div>
                <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"><CalendarDays size={17} /> View calendar</button>
              </div>

              <section aria-label="Quick statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} stat={stat} />)}</section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <article className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">Today&apos;s class schedule</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Tuesday, 15 October · 4 classes scheduled</p></div><button type="button" aria-label="Schedule options" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><MoreHorizontal size={18} /></button></div>
                  <div className="divide-y divide-slate-100 p-1 dark:divide-slate-700">{schedule.map((item) => <div key={`${item.time}-${item.title}`} className="flex gap-4 px-4 py-4 sm:gap-7"><div className="w-16 shrink-0 pt-1 text-xs font-semibold text-slate-400">{item.time}</div><div className="relative flex min-w-0 flex-1 gap-3"><span className={`mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ${item.status === 'Ongoing' ? 'bg-indigo-500 ring-indigo-50 dark:ring-indigo-500/20' : item.status === 'Completed' ? 'bg-slate-300 ring-slate-100 dark:bg-slate-500 dark:ring-slate-700' : 'bg-amber-400 ring-amber-50 dark:ring-amber-500/20'}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</h3><Badge tone={item.tone}>{item.status}</Badge></div><p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{item.room}</p></div></div></div>)}</div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">Attendance overview</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current semester</p></div><ClipboardCheck size={19} className="text-indigo-500" /></div><div className="flex flex-col items-center py-8"><div className="relative grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(#4f46e5 ${attendance * 3.6}deg, #e2e8f0 0deg)` }}><div className="grid size-32 place-items-center rounded-full bg-white dark:bg-slate-800"><div className="text-center"><strong className="block text-3xl font-bold text-slate-900 dark:text-white">{attendance}%</strong><span className="text-xs text-slate-500 dark:text-slate-400">overall rate</span></div></div></div><div className={`mt-6 flex items-center gap-2 text-sm font-semibold ${attendance < 75 ? 'text-amber-600' : 'text-emerald-600'}`}>{attendance < 75 ? <CircleAlert size={16} /> : <Check size={16} />}{attendance < 75 ? 'Needs attention' : 'Above target'}</div></div><div className="flex justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-700"><span className="text-slate-500 dark:text-slate-400">Target <strong className="text-slate-700 dark:text-slate-200">75%</strong></span><button type="button" className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">View report <ChevronRight className="inline" size={14} /></button></div></article>
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2 dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">Recent assignment submissions</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Review the latest student activity</p></div><button type="button" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">View all</button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400"><tr><th className="px-5 py-3 font-semibold">Assignment</th><th className="px-5 py-3 font-semibold">Due date</th><th className="px-5 py-3 font-semibold">Submissions</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{filteredAssignments.map((item) => <tr key={item.title} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/40"><td className="px-5 py-4"><strong className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</strong><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{item.course}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{item.due}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{item.submissions}</td><td className="px-5 py-4"><Badge tone={item.status === 'Submitted' ? 'emerald' : item.status === 'Graded' ? 'indigo' : 'amber'}>{item.status}</Badge></td></tr>)}</tbody></table></div></article>
                <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">Notice board</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Keep up with campus updates</p></div><button type="button" aria-label="Add notice" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"><span className="text-xl leading-none">+</span></button></div><div className="divide-y divide-slate-100 dark:divide-slate-700">{notices.map((notice) => <div key={notice.title} className="px-5 py-4"><Badge tone={notice.tone}>{notice.category}</Badge><h3 className="mt-2 text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">{notice.title}</h3><p className="mt-1 text-xs text-slate-400">{notice.date}</p></div>)}</div><button type="button" className="w-full border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-indigo-600 hover:bg-slate-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-700/40">View all announcements <ChevronRight className="inline" size={15} /></button></article>
              </section>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
