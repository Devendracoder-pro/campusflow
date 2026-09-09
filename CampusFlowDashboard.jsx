import { useEffect, useMemo, useState } from 'react';
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

function StatCard({ stat, onAction }) {
  const Icon = stat.icon;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-lg p-2.5 ${toneClasses[stat.tone]}`}><Icon size={19} strokeWidth={2} /></div>
        <button type="button" onClick={() => onAction(`Showing details for ${stat.label}.`)} aria-label={`More options for ${stat.label}`} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><MoreHorizontal size={18} /></button>
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
  apiBase = '/api',
}) {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [courses, setCourses] = useState([]);
  const [attendanceEntries, setAttendanceEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [dataError, setDataError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const paths = ['/me', '/students', '/faculty', '/courses', '/attendance', '/payments'];
        const responses = await Promise.all(paths.map((path) => fetch(`${apiBase}${path}`, { credentials: 'include' })));
        if (responses.some((response) => response.status === 401)) throw new Error('Please sign in to view live campus data.');
        if (responses.some((response) => !response.ok)) throw new Error('Unable to load live dashboard data.');
        const payloads = await Promise.all(responses.map((response) => response.json()));
        if (!active) return;
        setUser(payloads[0].user);
        setStudents(payloads[1].data || []);
        setFaculty(payloads[2].data || []);
        setCourses(payloads[3].data || []);
        setAttendanceEntries(payloads[4].data || []);
        setPayments(payloads[5].data || []);
      } catch (error) {
        if (active) setDataError(error.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [apiBase]);

  const currentUser = user ? { name: user.display_name, role: user.role, initials: user.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() } : { name: 'Campus user', role: 'Loading', initials: '?' };
  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const activeStudents = students.filter((student) => student.status === 'Active');
  const presentToday = attendanceEntries.filter((entry) => entry.date === today && entry.status === 'Present').length;
  const attendance = activeStudents.length ? Math.round((presentToday / activeStudents.length) * 1000) / 10 : 0;
  const collected = payments.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const stats = [
    { label: 'Total Students', value: students.length.toLocaleString(), trend: 'Live', tone: 'indigo', icon: Users },
    { label: 'Attendance Rate', value: `${attendance}%`, trend: 'Today', tone: 'emerald', icon: ClipboardCheck },
    { label: 'Faculty Members', value: faculty.length.toLocaleString(), trend: 'Live', tone: 'amber', icon: BookOpen },
    { label: 'Fees Collected', value: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(collected), trend: 'Live', tone: 'rose', icon: WalletCards },
  ];
  const emptySchedule = [];
  const emptyAssignments = [];
  const emptyNotices = [];

  const filteredAssignments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return emptyAssignments;
    return emptyAssignments.filter((item) => `${item.title} ${item.course} ${item.status}`.toLowerCase().includes(normalized));
  }, [query]);

  const closeMobileNav = () => setSidebarOpen(false);
  const notify = (message) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 2600);
  };

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
              <button type="button" onClick={() => notify(`Opening ${currentUser.name}'s profile.`)} title={collapsed ? currentUser.name : undefined} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-slate-700 ${collapsed ? 'lg:justify-center' : ''}`}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{currentUser.initials}</span>
                <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}><strong className="block truncate text-sm text-white">{currentUser.name}</strong><small className="block truncate text-xs text-slate-400">{currentUser.role}</small></span>
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
                <button type="button" onClick={() => notify('You have 3 unread notifications.')} aria-label="Notifications" className="relative rounded-lg p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Bell size={19} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" /></button>
                <div className="relative">
                  <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><span className="grid size-9 place-items-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{currentUser.initials}</span><ChevronDown size={15} className="hidden text-slate-400 sm:block" /></button>
                  {profileOpen && <div className="absolute right-0 top-12 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-800"><button type="button" onClick={() => { notify('Profile settings opened.'); setProfileOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Profile</button><button type="button" onClick={() => { notify('Sign out is ready to connect to your auth endpoint.'); setProfileOpen(false); }} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700">Sign out</button></div>}
                </div>
              </div>
            </header>

            <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-7 md:px-8 lg:px-10">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">{todayLabel}</p><h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white md:text-4xl">Good morning, {currentUser.name.split(' ')[0]}</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Metrics below are fetched from your CampusFlow workspace.</p></div>
                <button type="button" onClick={() => notify('Calendar view opened.')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"><CalendarDays size={17} /> View calendar</button>
              </div>

              {dataError && <div role="alert" className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{dataError}</div>}
              {loading && <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Loading live workspace data...</div>}
              <section aria-label="Quick statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((stat) => <StatCard key={stat.label} stat={stat} onAction={notify} />)}</section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <article className="rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">Today&apos;s class schedule</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fetched from your timetable data</p></div><button type="button" onClick={() => notify('Schedule options opened.')} aria-label="Schedule options" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"><MoreHorizontal size={18} /></button></div>
                  <div className="divide-y divide-slate-100 p-1 dark:divide-slate-700">{emptySchedule.length ? emptySchedule.map((item) => <div key={`${item.time}-${item.title}`} className="flex gap-4 px-4 py-4 sm:gap-7"><div className="w-16 shrink-0 pt-1 text-xs font-semibold text-slate-400">{item.time}</div><div className="relative flex min-w-0 flex-1 gap-3"><span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-indigo-500" /><div className="min-w-0"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.room}</p></div></div></div>) : <p className="px-4 py-8 text-sm text-slate-500 dark:text-slate-400">No timetable data is available yet.</p>}</div>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-900 dark:text-white">Attendance overview</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current semester</p></div><ClipboardCheck size={19} className="text-indigo-500" /></div><div className="flex flex-col items-center py-8"><div className="relative grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(#4f46e5 ${attendance * 3.6}deg, #e2e8f0 0deg)` }}><div className="grid size-32 place-items-center rounded-full bg-white dark:bg-slate-800"><div className="text-center"><strong className="block text-3xl font-bold text-slate-900 dark:text-white">{attendance}%</strong><span className="text-xs text-slate-500 dark:text-slate-400">overall rate</span></div></div></div><div className={`mt-6 flex items-center gap-2 text-sm font-semibold ${attendance < 75 ? 'text-amber-600' : 'text-emerald-600'}`}>{attendance < 75 ? <CircleAlert size={16} /> : <Check size={16} />}{attendance < 75 ? 'Needs attention' : 'Above target'}</div></div><div className="flex justify-between border-t border-slate-100 pt-4 text-xs dark:border-slate-700"><span className="text-slate-500 dark:text-slate-400">Target <strong className="text-slate-700 dark:text-slate-200">75%</strong></span><button type="button" onClick={() => notify('Attendance report opened.')} className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">View report <ChevronRight className="inline" size={14} /></button></div></article>
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-2 dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">Recent assignment submissions</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only connected assignment data is shown</p></div><button type="button" onClick={() => notify('Assignments endpoint is not available in the current API.')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">View all</button></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50 dark:text-slate-400"><tr><th className="px-5 py-3 font-semibold">Assignment</th><th className="px-5 py-3 font-semibold">Due date</th><th className="px-5 py-3 font-semibold">Submissions</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{filteredAssignments.length ? filteredAssignments.map((item) => <tr key={item.title} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/40"><td className="px-5 py-4"><strong className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</strong><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{item.course}</span></td><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500 dark:text-slate-400">{item.due}</td><td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{item.submissions}</td><td className="px-5 py-4"><Badge tone={item.status === 'Submitted' ? 'emerald' : item.status === 'Graded' ? 'indigo' : 'amber'}>{item.status}</Badge></td></tr>) : <tr><td colSpan="4" className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No assignment data is available from the current API.</td></tr>}</tbody></table></div></article>
                <article className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700"><div><h2 className="font-bold text-slate-900 dark:text-white">Notice board</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only connected notices are shown</p></div><button type="button" onClick={() => notify('Announcements endpoint is not available in the current API.')} aria-label="Add notice" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"><span className="text-xl leading-none">+</span></button></div><div className="divide-y divide-slate-100 dark:divide-slate-700">{emptyNotices.length ? emptyNotices.map((notice) => <div key={notice.title} className="px-5 py-4"><Badge tone={notice.tone}>{notice.category}</Badge><h3 className="mt-2 text-sm font-semibold leading-5 text-slate-800 dark:text-slate-100">{notice.title}</h3><p className="mt-1 text-xs text-slate-400">{notice.date}</p></div>) : <p className="px-5 py-8 text-sm text-slate-500 dark:text-slate-400">No announcements are available yet.</p>}</div><button type="button" onClick={() => notify('Announcements endpoint is not available in the current API.')} className="w-full border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-indigo-600 hover:bg-slate-50 dark:border-slate-700 dark:text-indigo-300 dark:hover:bg-slate-700/40">View all announcements <ChevronRight className="inline" size={15} /></button></article>
              </section>
            </main>
            {feedback && <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl dark:bg-white dark:text-slate-900">{feedback}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
