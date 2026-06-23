import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Mail, PencilLine, Plus, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { MediaField } from '../../components/MediaField';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import {
  createManagedUserAccount,
  deactivateManagedProfile,
  deriveEnabledPortalAccessStatus,
  derivePortalAccessStatus,
  generateTemporaryPassword,
  sendManagedPasswordReset,
  syncManagedProfile,
} from '../../lib/access';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { formatDateTime, getInitials } from '../../lib/utils';
import type { SchoolClass, StaffRecord } from '../../types/app';

interface StaffForm {
  full_name: string;
  email: string;
  phone_number: string;
  designation: string;
  photo_url: string;
  class_teacher_for: string[];
  is_active: boolean;
}

const emptyForm: StaffForm = {
  full_name: '',
  email: '',
  phone_number: '',
  designation: '',
  photo_url: '',
  class_teacher_for: [],
  is_active: true,
};

const teacherPermissions = ['parent_contact_view', 'medical_view'];

interface GeneratedCredential {
  teacherId: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
}

function getCredentialStorageKey(schoolId: string) {
  return `cuddlecub-teacher-credentials:${schoolId}`;
}

function readStoredCredentials(schoolId: string): Record<string, GeneratedCredential> {
  try {
    return JSON.parse(localStorage.getItem(getCredentialStorageKey(schoolId)) ?? '{}') as Record<string, GeneratedCredential>;
  } catch {
    return {};
  }
}

function storeCredentials(schoolId: string, credentials: Record<string, GeneratedCredential>) {
  try {
    localStorage.setItem(getCredentialStorageKey(schoolId), JSON.stringify(credentials));
  } catch {
    // The password is still visible for this session even if browser storage is unavailable.
  }
}

function getStaffLoginUrl() {
  return `${window.location.origin}/login`;
}

export function StaffPage() {
  const { school } = useAppContext();
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teacherClassMap, setTeacherClassMap] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState(emptyForm);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [accessTeacher, setAccessTeacher] = useState<StaffRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAccessId, setBusyAccessId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [generatedCredential, setGeneratedCredential] = useState<GeneratedCredential | null>(null);
  const [generatedCredentials, setGeneratedCredentials] = useState<Record<string, GeneratedCredential>>({});

  useEffect(() => {
    void loadStaff();
  }, [school.id]);

  useEffect(() => {
    setGeneratedCredentials(readStoredCredentials(school.id));
  }, [school.id]);

  async function loadStaff() {
    setMessage(null);

    try {
      const [staffResponse, classResponse] = await Promise.all([
        supabase.from('staff').select('*').eq('school_id', school.id).eq('role', 'teacher').order('created_at', { ascending: false }),
        supabase.from('classes').select('*').eq('school_id', school.id).order('name'),
      ]);

      if (staffResponse.error) throw staffResponse.error;
      if (classResponse.error) throw classResponse.error;

      const nextStaff = (staffResponse.data ?? []) as StaffRecord[];
      const nextClasses = (classResponse.data ?? []) as SchoolClass[];
      const nextTeacherClassMap = nextClasses.reduce<Record<string, string[]>>((accumulator, schoolClass) => {
        if (schoolClass.class_teacher_staff_id) {
          accumulator[schoolClass.class_teacher_staff_id] = [...(accumulator[schoolClass.class_teacher_staff_id] ?? []), schoolClass.id];
        }

        return accumulator;
      }, {});

      setStaff(nextStaff);
      setClasses(nextClasses);
      setTeacherClassMap(nextTeacherClassMap);

      return nextStaff;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return [];
    }
  }

  function openCreateModal() {
    setEditingStaffId(null);
    setForm(emptyForm);
    setGeneratedCredential(null);
    setIsFormModalOpen(true);
  }

  function openEditModal(member: StaffRecord) {
    setEditingStaffId(member.id);
    setForm({
      full_name: member.full_name,
      email: member.email ?? '',
      phone_number: member.phone_number ?? '',
      designation: member.designation,
      photo_url: member.photo_url ?? '',
      class_teacher_for: teacherClassMap[member.id] ?? (member.class_teacher_for ? [member.class_teacher_for] : []),
      is_active: member.is_active,
    });
    setGeneratedCredential(null);
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setEditingStaffId(null);
    setForm(emptyForm);
    setIsFormModalOpen(false);
  }

  function openAccessModal(member: StaffRecord) {
    setAccessTeacher(member);
    if (generatedCredential?.teacherId !== member.id) {
      setGeneratedCredential(null);
    }
  }

  function closeAccessModal() {
    setAccessTeacher(null);
    setGeneratedCredential(null);
  }

  function syncOpenAccessModal(nextStaff: StaffRecord[], teacherId: string) {
    setAccessTeacher(nextStaff.find((member) => member.id === teacherId) ?? null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const isEditing = Boolean(editingStaffId);
    const currentTeacher = editingStaffId ? staff.find((member) => member.id === editingStaffId) ?? null : null;
    const selectedClassIds = form.class_teacher_for;
    const primaryClassId = selectedClassIds[0] ?? null;

    try {
      const payload = {
        school_id: school.id,
        full_name: form.full_name,
        email: form.email || null,
        phone_number: form.phone_number || null,
        designation: form.designation,
        role: 'teacher',
        photo_url: form.photo_url || null,
        permissions: teacherPermissions,
        class_teacher_for: primaryClassId,
        is_active: form.is_active,
      };

      let staffId = editingStaffId;

      if (editingStaffId) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editingStaffId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('staff').insert(payload).select('id').single();
        if (error) throw error;
        staffId = data.id as string;
      }

      if (staffId) {
        const { error: clearError } = await supabase.from('classes').update({ class_teacher_staff_id: null }).eq('class_teacher_staff_id', staffId);
        if (clearError) throw clearError;
      }

      if (selectedClassIds.length && staffId) {
        const { error } = await supabase.from('classes').update({ class_teacher_staff_id: staffId }).in('id', selectedClassIds);
        if (error) throw error;
      }

      if (currentTeacher?.user_id) {
        await syncManagedProfile({
          userId: currentTeacher.user_id,
          schoolId: school.id,
          fullName: payload.full_name,
          phone: payload.phone_number,
          role: 'teacher',
          isActive: payload.is_active,
        });
      }

      await loadStaff();
      closeFormModal();
      setMessage(isEditing ? 'Teacher updated.' : 'Teacher added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleCreateLogin(member: StaffRecord) {
    if (!member.email) {
      setMessage('Add an email address before creating teacher credentials.');
      return;
    }

    if (member.user_id) {
      setMessage('This teacher already has a linked login. Use reset link instead.');
      return;
    }

    setBusyAccessId(member.id);
    setGeneratedCredential(null);
    setMessage(null);

    try {
      const email = member.email;
      const temporaryPassword = generateTemporaryPassword();
      const { user, welcomeEmail } = await createManagedUserAccount(
        email,
        temporaryPassword,
        {
          schoolId: school.id,
          fullName: member.full_name,
          phone: member.phone_number ?? null,
          role: 'teacher',
          isActive: member.is_active,
        },
        {
          sendWelcomeEmail: true,
          loginUrl: getStaffLoginUrl(),
          schoolName: school.name,
        },
      );
      const accessInvitedAt = new Date().toISOString();

      const { error } = await supabase
        .from('staff')
        .update({
          user_id: user.id,
          access_status: member.is_active ? 'invited' : 'disabled',
          access_invited_at: accessInvitedAt,
          portal_password: temporaryPassword,
        })
        .eq('id', member.id);

      if (error) throw error;

      await syncManagedProfile({
        userId: user.id,
        schoolId: school.id,
        fullName: member.full_name,
        phone: member.phone_number ?? null,
        role: 'teacher',
        isActive: member.is_active,
      });

      const nextStaff = await loadStaff();
      syncOpenAccessModal(nextStaff, member.id);
      setGeneratedCredential({
        teacherId: member.id,
        fullName: member.full_name,
        email,
        temporaryPassword,
      });
      setGeneratedCredentials((current) => {
        const nextCredentials = {
          ...current,
          [member.id]: {
            teacherId: member.id,
            fullName: member.full_name,
            email,
            temporaryPassword,
          },
        };
        storeCredentials(school.id, nextCredentials);
        return nextCredentials;
      });
      setMessage(
        welcomeEmail?.sent
          ? 'Teacher login created and welcome email sent with credentials.'
          : `Teacher login created, but email was not sent${welcomeEmail?.reason ? `: ${welcomeEmail.reason}` : '.'}`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleSendWelcomeEmail(member: StaffRecord) {
    if (!member.email) {
      setMessage('Add an email address before sending teacher credentials.');
      return;
    }

    const credential =
      generatedCredential?.teacherId === member.id
        ? generatedCredential
        : generatedCredentials[member.id] ?? null;

    if (!credential?.temporaryPassword) {
      setMessage('No saved temporary password is available. Create a new login or send a reset link.');
      return;
    }

    setBusyAccessId(member.id);
    setMessage(null);

    try {
      const { user, welcomeEmail } = await createManagedUserAccount(
        member.email,
        credential.temporaryPassword,
        {
          schoolId: school.id,
          fullName: member.full_name,
          phone: member.phone_number ?? null,
          role: 'teacher',
          isActive: member.is_active,
        },
        {
          sendWelcomeEmail: true,
          loginUrl: getStaffLoginUrl(),
          schoolName: school.name,
        },
      );

      if (member.user_id !== user.id) {
        const { error } = await supabase.from('staff').update({ user_id: user.id }).eq('id', member.id);
        if (error) throw error;
      }

      const nextStaff = await loadStaff();
      syncOpenAccessModal(nextStaff, member.id);
      setGeneratedCredential(credential);
      setMessage(
        welcomeEmail?.sent
          ? 'Welcome email sent with teacher login credentials.'
          : `Welcome email was not sent${welcomeEmail?.reason ? `: ${welcomeEmail.reason}` : '.'}`,
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleSendResetLink(member: StaffRecord) {
    if (!member.email) {
      setMessage('Add an email address before sending a reset link.');
      return;
    }

    if (deriveEnabledPortalAccessStatus(member) === 'not_created') {
      setMessage('Create the teacher login first, then send a reset link.');
      return;
    }

    setBusyAccessId(member.id);
    setMessage(null);

    try {
      const resetSentAt = new Date().toISOString();
      await sendManagedPasswordReset(member.email);

      const { error } = await supabase
        .from('staff')
        .update({
          password_reset_sent_at: resetSentAt,
          access_status: member.is_active ? deriveEnabledPortalAccessStatus({ ...member, password_reset_sent_at: resetSentAt }) : 'disabled',
        })
        .eq('id', member.id);

      if (error) throw error;

      const nextStaff = await loadStaff();
      syncOpenAccessModal(nextStaff, member.id);
      setMessage('Password reset link sent to the teacher email address.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleToggleAccess(member: StaffRecord) {
    setBusyAccessId(member.id);
    setMessage(null);

    const nextIsActive = !member.is_active;
    const nextStatus = nextIsActive ? deriveEnabledPortalAccessStatus(member) : 'disabled';

    try {
      const { error } = await supabase
        .from('staff')
        .update({
          is_active: nextIsActive,
          access_status: nextStatus,
        })
        .eq('id', member.id);

      if (error) throw error;

      if (member.user_id) {
        await syncManagedProfile({
          userId: member.user_id,
          schoolId: school.id,
          fullName: member.full_name,
          phone: member.phone_number ?? null,
          role: 'teacher',
          isActive: nextIsActive,
        });
      }

      const nextStaff = await loadStaff();
      syncOpenAccessModal(nextStaff, member.id);
      setMessage(nextIsActive ? 'Teacher access activated.' : 'Teacher access deactivated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleDeleteTeacher(member: StaffRecord) {
    const confirmed = window.confirm(`Delete ${member.full_name}? This will remove the teacher record and related teacher-specific history.`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(member.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('staff').delete().eq('id', member.id);
      if (error) throw error;

      if (member.user_id) {
        await deactivateManagedProfile(member.user_id);
      }

      await loadStaff();
      closeAccessModal();
      closeFormModal();
      setMessage('Teacher deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const classLookup = useMemo(
    () =>
      classes.reduce<Record<string, string>>((accumulator, item) => {
        accumulator[item.id] = item.name;
        return accumulator;
      }, {}),
    [classes],
  );
  const getTeacherClassNames = (teacherId: string, fallbackClassId?: string | null) => {
    const classIds = teacherClassMap[teacherId] ?? (fallbackClassId ? [fallbackClassId] : []);
    return classIds.map((classId) => classLookup[classId]).filter(Boolean);
  };

  const editingTeacher = editingStaffId ? staff.find((member) => member.id === editingStaffId) ?? null : null;
  const accessTeacherStatus = accessTeacher ? derivePortalAccessStatus(accessTeacher) : null;
  const accessTeacherCredential = accessTeacher
    ? generatedCredential?.teacherId === accessTeacher.id
      ? generatedCredential
      : generatedCredentials[accessTeacher.id] ?? (accessTeacher.portal_password ? { teacherId: accessTeacher.id, fullName: accessTeacher.full_name, email: accessTeacher.email ?? '', temporaryPassword: accessTeacher.portal_password } : null)
    : null;
  const summary = useMemo(
    () => ({
      total: staff.length,
      active: staff.filter((member) => member.is_active).length,
      loginReady: staff.filter((member) => deriveEnabledPortalAccessStatus(member) !== 'not_created').length,
      assigned: staff.filter((member) => (teacherClassMap[member.id] ?? (member.class_teacher_for ? [member.class_teacher_for] : [])).length > 0).length,
    }),
    [staff, teacherClassMap],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Teacher Management"
        title="Teacher directory and class assignment"
        description="Keep teacher records, class ownership and account access cleanly managed from one directory view."
        actions={
          <button className="button-primary gap-2" onClick={openCreateModal} type="button">
            <Plus className="h-4 w-4" />
            Add teacher
          </button>
        }
      />
      <ToastMessage message={message} />

      <SectionCard
        title="Teacher list"
        description="A clean view of each teacher, their class assignment and account access status."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{summary.total} total</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{summary.active} active</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{summary.loginReady} login ready</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{summary.assigned} assigned</span>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: 'teacher',
              label: 'Teacher',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-extrabold text-slate-700">
                    {getInitials(row.full_name)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{row.full_name}</p>
                    <p className="text-xs text-slate-500">{row.email ?? 'No email added'}</p>
                    <p className="text-xs text-slate-400">{row.phone_number ?? 'No phone number'}</p>
                  </div>
                </div>
              ),
            },
            { key: 'designation', label: 'Designation', render: (row) => row.designation || 'Teacher' },
            {
              key: 'class',
              label: 'Assigned classes',
              render: (row) => {
                const classNames = getTeacherClassNames(row.id, row.class_teacher_for);

                return (
                  <span className={classNames.length ? 'font-semibold text-slate-700' : 'text-slate-500'}>
                    {classNames.length ? classNames.join(', ') : 'Not assigned'}
                  </span>
                );
              },
            },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.is_active ? 'active' : 'inactive'} /> },
            {
              key: 'access',
              label: 'Access',
              render: (row) => (
                <div>
                  <StatusBadge value={derivePortalAccessStatus(row).replace('_', ' ')} />
                  <p className="mt-2 text-xs text-slate-500">
                    {row.last_login_at
                      ? `Last login ${formatDateTime(row.last_login_at)}`
                      : row.password_reset_sent_at
                        ? `Reset sent ${formatDateTime(row.password_reset_sent_at)}`
                        : row.access_invited_at
                          ? `Credentials created ${formatDateTime(row.access_invited_at)}`
                          : 'No login created'}
                  </p>
                </div>
              ),
            },
            {
              key: 'password',
              label: 'Password',
              render: (row) => {
                const password = row.portal_password ?? generatedCredentials[row.id]?.temporaryPassword ?? null;

                return password ? (
                  <div>
                    <p className="font-mono text-sm text-slate-900">{password}</p>
                    <p className="mt-1 text-xs text-slate-500">Managed</p>
                  </div>
                ) : (
                  <span className="text-slate-500">Not available</span>
                );
              },
            },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditModal(row)} type="button">
                    <PencilLine className="mr-1 h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button className="button-secondary px-3 py-2 text-xs" onClick={() => openAccessModal(row)} type="button">
                    <KeyRound className="mr-1 h-3.5 w-3.5" />
                    Access
                  </button>
                </div>
              ),
            },
          ]}
          emptyMessage="No teacher records added yet."
          rows={staff}
        />
      </SectionCard>

      <Modal
        description="Add the teacher profile first. Login credentials can be created separately from access controls."
        onClose={closeFormModal}
        open={isFormModalOpen}
        title={editingStaffId ? 'Edit teacher' : 'Add teacher'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              placeholder="Teacher full name"
              required
              value={form.full_name}
            />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input
              className="form-input"
              disabled={Boolean(editingTeacher?.user_id)}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="teacher@school.com"
              type="email"
              value={form.email}
            />
            {editingTeacher?.user_id ? <p className="mt-2 text-xs text-slate-500">Login already exists for this teacher, so the email is locked.</p> : null}
          </div>
          <div>
            <label className="form-label">Phone number</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
              placeholder="Phone number"
              value={form.phone_number}
            />
          </div>
          <div>
            <label className="form-label">Designation</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))}
              placeholder="Class teacher"
              required
              value={form.designation}
            />
          </div>
          <div>
            <MediaField
              helperText="Pick or upload the teacher photo from the shared media library."
              label="Profile image"
              onChange={(value) => setForm((current) => ({ ...current, photo_url: value }))}
              value={form.photo_url}
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Class teacher for</label>
            <div className="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-white p-3 sm:grid-cols-2">
              {classes.length ? (
                classes.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      checked={form.class_teacher_for.includes(item.id)}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          class_teacher_for: event.target.checked
                            ? [...current.class_teacher_for, item.id]
                            : current.class_teacher_for.filter((classId) => classId !== item.id),
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{item.name}</span>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500">Add classes in School Setup before assigning teachers.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">Select every class this teacher should manage. The first selected class is kept as the primary class for older reports.</p>
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            <div>
              <p className="font-semibold text-slate-700">Teacher access active</p>
              <p className="text-xs text-slate-500">You can disable or reactivate this account later from access controls.</p>
            </div>
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingTeacher ? (
              <button className="button-danger mr-auto gap-2" disabled={busyDeleteId === editingTeacher.id} onClick={() => void handleDeleteTeacher(editingTeacher)} type="button">
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingTeacher.id ? 'Deleting...' : 'Delete teacher'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeFormModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingStaffId ? 'Save changes' : 'Add teacher'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Create credentials, send reset links, and control whether this teacher can access the portal."
        onClose={closeAccessModal}
        open={Boolean(accessTeacher)}
        title={accessTeacher ? `${accessTeacher.full_name} access` : 'Teacher access'}
      >
        {accessTeacher ? (
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">{accessTeacher.full_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{accessTeacher.email ?? 'No email added yet'}</p>
                </div>
                <StatusBadge value={accessTeacherStatus?.replace('_', ' ')} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Role</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{accessTeacher.designation || 'Teacher'}</p>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Assigned classes</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {getTeacherClassNames(accessTeacher.id, accessTeacher.class_teacher_for).length
                      ? getTeacherClassNames(accessTeacher.id, accessTeacher.class_teacher_for).join(', ')
                      : 'Not assigned'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Last activity</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {accessTeacher.last_login_at
                      ? `Login ${formatDateTime(accessTeacher.last_login_at)}`
                      : accessTeacher.password_reset_sent_at
                        ? `Reset ${formatDateTime(accessTeacher.password_reset_sent_at)}`
                        : accessTeacher.access_invited_at
                          ? `Created ${formatDateTime(accessTeacher.access_invited_at)}`
                          : 'No account activity'}
                  </p>
                </div>
              </div>
            </div>

            {!accessTeacher.email ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Add an email address in the teacher profile before creating login credentials.
              </div>
            ) : null}

            {accessTeacherCredential ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Temporary password</p>
                <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900">{accessTeacherCredential.temporaryPassword}</div>
                <p className="mt-3 text-sm text-slate-500">Share this once with the teacher, or use reset link to let them create their own password.</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {deriveEnabledPortalAccessStatus(accessTeacher) === 'not_created' ? (
                <button
                  className="button-primary gap-2"
                  disabled={busyAccessId === accessTeacher.id || !accessTeacher.email}
                  onClick={() => void handleCreateLogin(accessTeacher)}
                  type="button"
                >
                  <KeyRound className="h-4 w-4" />
                  {busyAccessId === accessTeacher.id ? 'Creating login...' : 'Create login'}
                </button>
              ) : (
                <>
                  {accessTeacherCredential ? (
                    <button
                      className="button-secondary gap-2"
                      disabled={busyAccessId === accessTeacher.id || !accessTeacher.email}
                      onClick={() => void handleSendWelcomeEmail(accessTeacher)}
                      type="button"
                    >
                      <Mail className="h-4 w-4" />
                      {busyAccessId === accessTeacher.id ? 'Sending email...' : 'Send welcome email'}
                    </button>
                  ) : null}

                  <button
                    className="button-primary gap-2"
                    disabled={busyAccessId === accessTeacher.id || !accessTeacher.email}
                    onClick={() => void handleSendResetLink(accessTeacher)}
                    type="button"
                  >
                    <KeyRound className="h-4 w-4" />
                    {busyAccessId === accessTeacher.id ? 'Sending link...' : 'Send reset link'}
                  </button>
                </>
              )}

              <button className="button-secondary gap-2" disabled={busyAccessId === accessTeacher.id} onClick={() => void handleToggleAccess(accessTeacher)} type="button">
                {accessTeacher.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {busyAccessId === accessTeacher.id ? 'Updating access...' : accessTeacher.is_active ? 'Deactivate access' : 'Activate access'}
              </button>

              <button
                className="button-secondary"
                onClick={() => {
                  closeAccessModal();
                  openEditModal(accessTeacher);
                }}
                type="button"
              >
                Edit teacher
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
