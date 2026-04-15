import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppContext } from './lib/app-context';
import { getErrorMessage, isSupabaseConfigured, supabase } from './lib/supabase';
import { canBootstrapSchoolAdmin, resolveUserRole } from './lib/portal';
import type { Profile, School } from './types/app';
import { AdminLayout } from './layouts/AdminLayout';
import { StaffLayout } from './layouts/StaffLayout';
import { ParentLayout } from './layouts/ParentLayout';
import { AuthPage } from './pages/AuthPage';
import { SchoolOnboardingPage } from './pages/SchoolOnboardingPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { AccessPendingPage } from './pages/AccessPendingPage';
import { UpdatePasswordPage } from './pages/UpdatePasswordPage';
import { LoadingScreen } from './components/LoadingScreen';
import { DashboardPage } from './pages/admin/DashboardPage';
import { SchoolSetupPage } from './pages/admin/SchoolSetupPage';
import { StudentsPage } from './pages/admin/StudentsPage';
import { ParentsPage } from './pages/admin/ParentsPage';
import { StaffPage } from './pages/admin/StaffPage';
import { AdmissionsPage } from './pages/admin/AdmissionsPage';
import { AcademicsPage } from './pages/admin/AcademicsPage';
import { AttendancePage } from './pages/admin/AttendancePage';
import { DailyCarePage } from './pages/admin/DailyCarePage';
import { FeesPage } from './pages/admin/FeesPage';
import { CommunicationPage } from './pages/admin/CommunicationPage';
import { EventsPage } from './pages/admin/EventsPage';
import { ReportsPage } from './pages/admin/ReportsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { WebsitePage } from './pages/admin/WebsitePage';
import { MediaPage } from './pages/admin/MediaPage';
import { StaffDashboardPage } from './pages/staff/StaffDashboardPage';
import { StaffStudentsPage } from './pages/staff/StaffStudentsPage';
import { StaffAttendancePage } from './pages/staff/StaffAttendancePage';
import { StaffDailyActivityPage } from './pages/staff/StaffDailyActivityPage';
import { StaffAcademicsPage } from './pages/staff/StaffAcademicsPage';
import { StaffCommunicationPage } from './pages/staff/StaffCommunicationPage';
import { StaffCelebrationsPage } from './pages/staff/StaffCelebrationsPage';
import { StaffSchedulePage } from './pages/staff/StaffSchedulePage';
import { ParentDashboardPage } from './pages/parent/ParentDashboardPage';
import { ParentChildPage } from './pages/parent/ParentChildPage';
import { ParentAttendancePage } from './pages/parent/ParentAttendancePage';
import { ParentDailyActivityPage } from './pages/parent/ParentDailyActivityPage';
import { ParentFeesPage } from './pages/parent/ParentFeesPage';
import { ParentCommunicationPage } from './pages/parent/ParentCommunicationPage';
import { ParentRequestsPage } from './pages/parent/ParentRequestsPage';
import { ParentEventsPage } from './pages/parent/ParentEventsPage';
import { PublicLayout } from './layouts/PublicLayout';
import { HomePage } from './pages/public/HomePage';
import { AboutPage } from './pages/public/AboutPage';
import { ProgramsPage } from './pages/public/ProgramsPage';
import { GalleryPage } from './pages/public/GalleryPage';
import { applyThemeFromSchool } from './lib/theme';

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;

  if (!data) {
    const { data: inserted, error: insertError } = await supabase.from('profiles').upsert({ user_id: userId }).select('*').single();
    if (insertError) throw insertError;
    return inserted as Profile;
  }

  return data as Profile;
}

async function fetchSchool(schoolId: string) {
  const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).single();
  if (error) throw error;
  return data as School;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [canCreateFirstAdmin, setCanCreateFirstAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const sessionUserIdRef = useRef<string | null>(null);
  const hasResolvedInitialSessionRef = useRef(false);

  async function loadSessionData(currentSession: Session | null) {
    const previousUserId = sessionUserIdRef.current;
    const nextUserId = currentSession?.user?.id ?? null;
    const shouldShowBlockingLoader = !hasResolvedInitialSessionRef.current || previousUserId !== nextUserId;

    setSession(currentSession);
    setError(null);
    sessionUserIdRef.current = nextUserId;

    if (!currentSession?.user) {
      setProfile(null);
      setSchool(null);
      setCanCreateFirstAdmin(false);
      hasResolvedInitialSessionRef.current = true;
      if (shouldShowBlockingLoader) {
        setLoading(false);
      }
      return;
    }

    if (shouldShowBlockingLoader) {
      setLoading(true);
    }

    try {
      await resolveUserRole();
      const nextProfile = await fetchProfile(currentSession.user.id);
      setProfile(nextProfile);

      if (nextProfile.school_id) {
        const nextSchool = await fetchSchool(nextProfile.school_id);
        applyThemeFromSchool({
          primary_color: nextSchool.primary_color,
          secondary_color: nextSchool.secondary_color,
          settings: nextSchool.settings,
        });
        setSchool(nextSchool);
        setCanCreateFirstAdmin(false);
      } else {
        setSchool(null);
        setCanCreateFirstAdmin(await canBootstrapSchoolAdmin());
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      hasResolvedInitialSessionRef.current = true;
      if (shouldShowBlockingLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let mounted = true;
    const recoveryHash = typeof window !== 'undefined' ? `${window.location.search}${window.location.hash}` : '';

    if (recoveryHash.includes('type=recovery')) {
      setIsPasswordRecovery(true);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        void loadSessionData(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }

      if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setIsPasswordRecovery(false);
      }

      void loadSessionData(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function refreshProfile() {
    if (!session?.user) return;
    const nextProfile = await fetchProfile(session.user.id);
    setProfile(nextProfile);
  }

  async function refreshSchool() {
    if (!profile?.school_id) return;
    const nextSchool = await fetchSchool(profile.school_id);
    setSchool(nextSchool);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setSchool(null);
    setCanCreateFirstAdmin(false);
    setIsPasswordRecovery(false);
    sessionUserIdRef.current = null;
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="card-panel max-w-2xl p-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">Configuration Required</p>
          <h1 className="mt-4 font-serif text-4xl text-slate-900">Supabase environment variables are missing.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env.local`, then restart the Vite server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (session && isPasswordRecovery) {
    return <UpdatePasswordPage onDone={() => setIsPasswordRecovery(false)} />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card-panel max-w-2xl p-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-600">Load Error</p>
          <h1 className="mt-4 font-serif text-4xl text-slate-900">The app could not load the workspace.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route element={<PublicLayout />} path="/">
          <Route element={<HomePage />} index />
          <Route element={<AboutPage />} path="about" />
          <Route element={<ProgramsPage />} path="programs" />
          <Route element={<GalleryPage />} path="gallery" />
          <Route element={<AuthPage embedded />} path="login" />
        </Route>
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    );
  }

  if (profile && !profile.is_active) {
    return <AccessPendingPage mode="inactive" role={profile.role} />;
  }

  if (!profile?.school_id || !school) {
    if (canCreateFirstAdmin) {
      return <SchoolOnboardingPage onDone={async () => void loadSessionData(session)} />;
    }

    return <AccessPendingPage role={profile?.role} />;
  }

  if (profile.role === 'admin') {
    return (
      <AppContext.Provider
        value={{
          session,
          profile,
          school,
          refreshProfile,
          refreshSchool,
          signOut,
        }}
      >
        <Routes>
          <Route element={<AdminLayout />} path="/">
            <Route element={<DashboardPage />} index />
            <Route element={<SchoolSetupPage />} path="school-setup" />
            <Route element={<StudentsPage />} path="students" />
            <Route element={<ParentsPage />} path="parents" />
            <Route element={<StaffPage />} path="staff" />
            <Route element={<AdmissionsPage />} path="admissions" />
            <Route element={<AcademicsPage />} path="academics" />
            <Route element={<AttendancePage />} path="attendance" />
            <Route element={<DailyCarePage />} path="daily-care" />
            <Route element={<FeesPage />} path="fees" />
            <Route element={<CommunicationPage />} path="communication" />
            <Route element={<EventsPage />} path="events" />
            <Route element={<WebsitePage />} path="website" />
            <Route element={<MediaPage />} path="media" />
            <Route element={<ReportsPage />} path="reports" />
            <Route element={<SettingsPage />} path="settings" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Route>
          <Route element={<NotFoundPage />} path="*" />
        </Routes>
      </AppContext.Provider>
    );
  }

  if (profile.role === 'teacher' || profile.role === 'staff') {
    return (
      <AppContext.Provider
        value={{
          session,
          profile,
          school,
          refreshProfile,
          refreshSchool,
          signOut,
        }}
      >
        <Routes>
          <Route element={<Navigate replace to="/staff" />} path="/" />
          <Route element={<StaffLayout />} path="/staff">
            <Route element={<StaffDashboardPage />} index />
            <Route element={<StaffStudentsPage />} path="students" />
            <Route element={<StaffAttendancePage />} path="attendance" />
            <Route element={<StaffDailyActivityPage />} path="daily-activity" />
            <Route element={<StaffAcademicsPage />} path="academics" />
            <Route element={<StaffCommunicationPage />} path="communication" />
            <Route element={<StaffCelebrationsPage />} path="celebrations" />
            <Route element={<StaffSchedulePage />} path="schedule" />
          </Route>
          <Route element={<Navigate replace to="/staff" />} path="*" />
        </Routes>
      </AppContext.Provider>
    );
  }

  if (profile.role === 'parent') {
    return (
      <AppContext.Provider
        value={{
          session,
          profile,
          school,
          refreshProfile,
          refreshSchool,
          signOut,
        }}
      >
        <Routes>
          <Route element={<Navigate replace to="/parent" />} path="/" />
          <Route element={<ParentLayout />} path="/parent">
            <Route element={<ParentDashboardPage />} index />
            <Route element={<ParentChildPage />} path="child" />
            <Route element={<ParentAttendancePage />} path="attendance" />
            <Route element={<ParentDailyActivityPage />} path="daily-activity" />
            <Route element={<ParentFeesPage />} path="fees" />
            <Route element={<ParentCommunicationPage />} path="communication" />
            <Route element={<ParentRequestsPage />} path="requests" />
            <Route element={<ParentEventsPage />} path="events" />
          </Route>
          <Route element={<Navigate replace to="/parent" />} path="*" />
        </Routes>
      </AppContext.Provider>
    );
  }

  return <AccessPendingPage role={profile.role} />;
}
