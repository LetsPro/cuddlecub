import { useEffect, useMemo, useState } from 'react';
import { KeyRound, PencilLine, Plus, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
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
import type { ParentRecord } from '../../types/app';

const emptyForm = {
  full_name: '',
  phone_number: '',
  whatsapp_number: '',
  email: '',
  address: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  is_active: true,
};

interface GeneratedCredential {
  parentId: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
}

export function ParentsPage() {
  const { school } = useAppContext();
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [childrenMap, setChildrenMap] = useState<Record<string, string[]>>({});
  const [form, setForm] = useState(emptyForm);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [accessParent, setAccessParent] = useState<ParentRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAccessId, setBusyAccessId] = useState<string | null>(null);
  const [busyDeleteId, setBusyDeleteId] = useState<string | null>(null);
  const [generatedCredential, setGeneratedCredential] = useState<GeneratedCredential | null>(null);

  useEffect(() => {
    void loadParents();
  }, [school.id]);

  async function loadParents() {
    setMessage(null);

    try {
      const [parentResponse, linkResponse] = await Promise.all([
        supabase.from('parents').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('student_parents').select('parent_id, students(first_name, last_name)').eq('school_id', school.id),
      ]);

      if (parentResponse.error) throw parentResponse.error;
      if (linkResponse.error) throw linkResponse.error;

      const nextParents = (parentResponse.data ?? []) as ParentRecord[];
      const links = ((linkResponse.data ?? []) as Array<Record<string, any>>).reduce<Record<string, string[]>>((accumulator, row) => {
        const parentId = row.parent_id as string;
        const studentName = row.students ? `${row.students.first_name} ${row.students.last_name}` : null;

        if (!parentId || !studentName) {
          return accumulator;
        }

        accumulator[parentId] = [...(accumulator[parentId] ?? []), studentName];
        return accumulator;
      }, {});

      setParents(nextParents);
      setChildrenMap(links);

      return nextParents;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return [];
    }
  }

  function openCreateModal() {
    setEditingParentId(null);
    setForm(emptyForm);
    setGeneratedCredential(null);
    setIsFormModalOpen(true);
  }

  function openEditModal(parent: ParentRecord) {
    setEditingParentId(parent.id);
    setForm({
      full_name: parent.full_name,
      phone_number: parent.phone_number,
      whatsapp_number: parent.whatsapp_number ?? '',
      email: parent.email ?? '',
      address: parent.address ?? '',
      emergency_contact_name: parent.emergency_contact_name ?? '',
      emergency_contact_phone: parent.emergency_contact_phone ?? '',
      is_active: parent.is_active,
    });
    setGeneratedCredential(null);
    setIsFormModalOpen(true);
  }

  function closeFormModal() {
    setEditingParentId(null);
    setForm(emptyForm);
    setIsFormModalOpen(false);
  }

  function openAccessModal(parent: ParentRecord) {
    setAccessParent(parent);
    if (generatedCredential?.parentId !== parent.id) {
      setGeneratedCredential(null);
    }
  }

  function closeAccessModal() {
    setAccessParent(null);
    setGeneratedCredential(null);
  }

  function syncOpenAccessModal(nextParents: ParentRecord[], parentId: string) {
    setAccessParent(nextParents.find((parent) => parent.id === parentId) ?? null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const isEditing = Boolean(editingParentId);
    const currentParent = editingParentId ? parents.find((parent) => parent.id === editingParentId) ?? null : null;
    const payload = {
      school_id: school.id,
      full_name: form.full_name,
      phone_number: form.phone_number,
      whatsapp_number: form.whatsapp_number || null,
      email: form.email || null,
      address: form.address || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      notification_preferences: { channel: 'dashboard' },
      is_active: form.is_active,
    };

    try {
      if (editingParentId) {
        const { error } = await supabase.from('parents').update(payload).eq('id', editingParentId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('parents').insert(payload);
        if (error) throw error;
      }

      if (currentParent?.user_id) {
        await syncManagedProfile({
          userId: currentParent.user_id,
          schoolId: school.id,
          fullName: payload.full_name,
          phone: payload.phone_number,
          role: 'parent',
          isActive: payload.is_active,
        });
      }

      await loadParents();
      closeFormModal();
      setMessage(isEditing ? 'Parent updated.' : 'Parent added.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleCreateLogin(parent: ParentRecord) {
    if (!parent.email) {
      setMessage('Add an email address before creating parent credentials.');
      return;
    }

    if (parent.user_id) {
      setMessage('This parent already has a linked login. Use reset link instead.');
      return;
    }

    setBusyAccessId(parent.id);
    setGeneratedCredential(null);
    setMessage(null);

    try {
      const temporaryPassword = generateTemporaryPassword();
      const user = await createManagedUserAccount(parent.email, temporaryPassword);
      const accessInvitedAt = new Date().toISOString();

      const { error } = await supabase
        .from('parents')
        .update({
          user_id: user.id,
          access_status: parent.is_active ? 'invited' : 'disabled',
          access_invited_at: accessInvitedAt,
        })
        .eq('id', parent.id);

      if (error) throw error;

      await syncManagedProfile({
        userId: user.id,
        schoolId: school.id,
        fullName: parent.full_name,
        phone: parent.phone_number,
        role: 'parent',
        isActive: parent.is_active,
      });

      const nextParents = await loadParents();
      syncOpenAccessModal(nextParents, parent.id);
      setGeneratedCredential({
        parentId: parent.id,
        fullName: parent.full_name,
        email: parent.email,
        temporaryPassword,
      });
      setMessage('Parent login created. Share the temporary password or send a reset link.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleSendResetLink(parent: ParentRecord) {
    if (!parent.email) {
      setMessage('Add an email address before sending a reset link.');
      return;
    }

    if (deriveEnabledPortalAccessStatus(parent) === 'not_created') {
      setMessage('Create the parent login first, then send a reset link.');
      return;
    }

    setBusyAccessId(parent.id);
    setMessage(null);

    try {
      const resetSentAt = new Date().toISOString();
      await sendManagedPasswordReset(parent.email);

      const { error } = await supabase
        .from('parents')
        .update({
          password_reset_sent_at: resetSentAt,
          access_status: parent.is_active ? deriveEnabledPortalAccessStatus({ ...parent, password_reset_sent_at: resetSentAt }) : 'disabled',
        })
        .eq('id', parent.id);

      if (error) throw error;

      const nextParents = await loadParents();
      syncOpenAccessModal(nextParents, parent.id);
      setMessage('Password reset link sent to the parent email address.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleToggleAccess(parent: ParentRecord) {
    setBusyAccessId(parent.id);
    setMessage(null);

    const nextIsActive = !parent.is_active;
    const nextStatus = nextIsActive ? deriveEnabledPortalAccessStatus(parent) : 'disabled';

    try {
      const { error } = await supabase
        .from('parents')
        .update({
          is_active: nextIsActive,
          access_status: nextStatus,
        })
        .eq('id', parent.id);

      if (error) throw error;

      if (parent.user_id) {
        await syncManagedProfile({
          userId: parent.user_id,
          schoolId: school.id,
          fullName: parent.full_name,
          phone: parent.phone_number,
          role: 'parent',
          isActive: nextIsActive,
        });
      }

      const nextParents = await loadParents();
      syncOpenAccessModal(nextParents, parent.id);
      setMessage(nextIsActive ? 'Parent access activated.' : 'Parent access deactivated.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyAccessId(null);
    }
  }

  async function handleDeleteParent(parent: ParentRecord) {
    const confirmed = window.confirm(`Delete ${parent.full_name}? This will remove the parent record and child links for this profile.`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteId(parent.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('parents').delete().eq('id', parent.id);
      if (error) throw error;

      if (parent.user_id) {
        await deactivateManagedProfile(parent.user_id);
      }

      await loadParents();
      closeAccessModal();
      closeFormModal();
      setMessage('Parent deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteId(null);
    }
  }

  const editingParent = editingParentId ? parents.find((parent) => parent.id === editingParentId) ?? null : null;
  const accessParentStatus = accessParent ? derivePortalAccessStatus(accessParent) : null;
  const accessParentCredential = accessParent && generatedCredential?.parentId === accessParent.id ? generatedCredential : null;
  const summary = useMemo(
    () => ({
      total: parents.length,
      active: parents.filter((parent) => parent.is_active).length,
      loginReady: parents.filter((parent) => deriveEnabledPortalAccessStatus(parent) !== 'not_created').length,
      linked: parents.filter((parent) => (childrenMap[parent.id] ?? []).length > 0).length,
    }),
    [childrenMap, parents],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Parent Management"
        title="Contacts, preferences and family communication"
        description="Manage family records, child links, dashboard notice visibility and parent portal access from one clean directory."
        actions={
          <button className="button-primary gap-2" onClick={openCreateModal} type="button">
            <Plus className="h-4 w-4" />
            Add parent
          </button>
        }
      />
      <ToastMessage message={message} />

      <SectionCard
        title="Parent list"
        description="A clean view of family contacts, child links and login readiness."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{summary.total} total</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{summary.active} active</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{summary.loginReady} login ready</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{summary.linked} linked</span>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: 'parent',
              label: 'Parent',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-extrabold text-slate-700">
                    {getInitials(row.full_name)}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{row.full_name}</p>
                    <p className="text-xs text-slate-500">{row.email ?? 'No email added'}</p>
                    <p className="text-xs text-slate-400">{row.phone_number}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'contact',
              label: 'Contact',
              render: (row) => (
                <div>
                  <p className="text-sm text-slate-700">{row.whatsapp_number ?? 'No WhatsApp number'}</p>
                  <p className="text-xs text-slate-500">Dashboard notices enabled</p>
                </div>
              ),
            },
            {
              key: 'children',
              label: 'Children',
              render: (row) => (
                <span className={(childrenMap[row.id] ?? []).length ? 'text-slate-700' : 'text-slate-500'}>
                  {(childrenMap[row.id] ?? []).length ? childrenMap[row.id].join(', ') : 'Not linked'}
                </span>
              ),
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
          emptyMessage="No parents found."
          rows={parents}
        />
      </SectionCard>

      <Modal
        description="Create or update the parent profile first. Login credentials can be managed separately from the access modal."
        onClose={closeFormModal}
        open={isFormModalOpen}
        title={editingParentId ? 'Edit parent' : 'Add parent'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              placeholder="Parent full name"
              required
              value={form.full_name}
            />
          </div>
          <div>
            <label className="form-label">Phone number</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
              placeholder="Primary phone number"
              required
              value={form.phone_number}
            />
          </div>
          <div>
            <label className="form-label">WhatsApp number</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, whatsapp_number: event.target.value }))}
              placeholder="WhatsApp number"
              value={form.whatsapp_number}
            />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input
              className="form-input"
              disabled={Boolean(editingParent?.user_id)}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="parent@family.com"
              type="email"
              value={form.email}
            />
            {editingParent?.user_id ? <p className="mt-2 text-xs text-slate-500">Login already exists for this parent, so the email is locked.</p> : null}
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-500">
            Parent notices are now delivered through the <span className="font-semibold text-slate-800">dashboard only</span>.
          </div>
          <div>
            <label className="form-label">Emergency contact name</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, emergency_contact_name: event.target.value }))}
              placeholder="Emergency contact name"
              value={form.emergency_contact_name}
            />
          </div>
          <div>
            <label className="form-label">Emergency contact phone</label>
            <input
              className="form-input"
              onChange={(event) => setForm((current) => ({ ...current, emergency_contact_phone: event.target.value }))}
              placeholder="Emergency contact phone"
              value={form.emergency_contact_phone}
            />
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Address</label>
            <textarea
              className="form-input min-h-28"
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Home address"
              value={form.address}
            />
          </div>
          <label className="md:col-span-2 flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <input checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            <div>
              <p className="font-semibold text-slate-700">Parent access active</p>
              <p className="text-xs text-slate-500">You can activate or deactivate this account later from access controls.</p>
            </div>
          </label>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingParent ? (
              <button className="button-danger mr-auto gap-2" disabled={busyDeleteId === editingParent.id} onClick={() => void handleDeleteParent(editingParent)} type="button">
                <Trash2 className="h-4 w-4" />
                {busyDeleteId === editingParent.id ? 'Deleting...' : 'Delete parent'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeFormModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingParentId ? 'Save changes' : 'Add parent'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Create credentials, send reset links, and control whether this parent can access the portal."
        onClose={closeAccessModal}
        open={Boolean(accessParent)}
        title={accessParent ? `${accessParent.full_name} access` : 'Parent access'}
      >
        {accessParent ? (
          <div className="space-y-5">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/90 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-900">{accessParent.full_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{accessParent.email ?? 'No email added yet'}</p>
                </div>
                <StatusBadge value={accessParentStatus?.replace('_', ' ')} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Linked children</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">{(childrenMap[accessParent.id] ?? []).length ? childrenMap[accessParent.id].join(', ') : 'No linked child'}</p>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Notice channel</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">Dashboard only</p>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Last activity</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    {accessParent.last_login_at
                      ? `Login ${formatDateTime(accessParent.last_login_at)}`
                      : accessParent.password_reset_sent_at
                        ? `Reset ${formatDateTime(accessParent.password_reset_sent_at)}`
                        : accessParent.access_invited_at
                          ? `Created ${formatDateTime(accessParent.access_invited_at)}`
                          : 'No account activity'}
                  </p>
                </div>
              </div>
            </div>

            {!accessParent.email ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Add an email address in the parent profile before creating login credentials.
              </div>
            ) : null}

            {accessParentCredential ? (
              <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Temporary password</p>
                <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900">{accessParentCredential.temporaryPassword}</div>
                <p className="mt-3 text-sm text-slate-500">Share this once with the parent, or use reset link to let them create their own password.</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {deriveEnabledPortalAccessStatus(accessParent) === 'not_created' ? (
                <button
                  className="button-primary gap-2"
                  disabled={busyAccessId === accessParent.id || !accessParent.email}
                  onClick={() => void handleCreateLogin(accessParent)}
                  type="button"
                >
                  <KeyRound className="h-4 w-4" />
                  {busyAccessId === accessParent.id ? 'Creating login...' : 'Create login'}
                </button>
              ) : (
                <button
                  className="button-primary gap-2"
                  disabled={busyAccessId === accessParent.id || !accessParent.email}
                  onClick={() => void handleSendResetLink(accessParent)}
                  type="button"
                >
                  <KeyRound className="h-4 w-4" />
                  {busyAccessId === accessParent.id ? 'Sending link...' : 'Send reset link'}
                </button>
              )}

              <button className="button-secondary gap-2" disabled={busyAccessId === accessParent.id} onClick={() => void handleToggleAccess(accessParent)} type="button">
                {accessParent.is_active ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {busyAccessId === accessParent.id ? 'Updating access...' : accessParent.is_active ? 'Deactivate access' : 'Activate access'}
              </button>

              <button
                className="button-secondary"
                onClick={() => {
                  closeAccessModal();
                  openEditModal(accessParent);
                }}
                type="button"
              >
                Edit parent
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
