import { useEffect, useMemo, useState } from 'react';
import { Loader2, PencilLine, Plus, Trash2, UserCheck } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import {
  createManagedUserAccount,
  generateTemporaryPassword,
  syncManagedProfile,
} from '../../lib/access';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { ToastMessage } from '../../lib/toast';
import { formatDate } from '../../lib/utils';
import type { AdmissionRecord, InquiryRecord, StudentRecord } from '../../types/app';

function createInquirySeed() {
  return {
    child_name: '',
    parent_name: '',
    parent_email: '',
    phone_number: '',
    source: '',
    preferred_start_date: '',
    notes: '',
    status: 'new',
  };
}

function createAdmissionSeed() {
  return {
    inquiry_id: '',
    student_id: '',
    student_name: '',
    parent_name: '',
    parent_email: '',
    phone_number: '',
    dob: '',
    gender: 'other',
    status: 'pending_documents',
    submitted_at: '',
    confirmed_at: '',
    waitlist_rank: '',
  };
}

function createConvertSeed() {
  return {
    parent_email: '',
    dob: '',
    gender: 'other',
  };
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? fullName.trim();
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '-';

  return { firstName, lastName };
}

function createPlaceholderDate() {
  return new Date().toISOString().slice(0, 10);
}

function getAcademicYearToken(label: string | null | undefined) {
  const normalized = label?.trim() || `${new Date().getFullYear()}`;
  const years = normalized.match(/\d{4}/g);

  if (years?.length && years.length > 1) {
    return `${years[0]}${years[1].slice(-2)}`;
  }

  return normalized.replace(/\D/g, '') || `${new Date().getFullYear()}`;
}

interface ParentAccessLookup {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string;
  userId: string | null;
  isActive: boolean;
  accessStatus: string | null;
  accessInvitedAt: string | null;
  passwordResetSentAt: string | null;
  lastLoginAt: string | null;
}

interface GeneratedAdmissionCredential {
  parentName: string;
  email: string;
  temporaryPassword: string;
  welcomeEmailSent?: boolean;
  welcomeEmailReason?: string;
}

function getParentLoginUrl() {
  return `${window.location.origin}/login`;
}

export function AdmissionsPage() {
  const { school } = useAppContext();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [studentParentLookup, setStudentParentLookup] = useState<Record<string, string>>({});
  const [studentParentAccessLookup, setStudentParentAccessLookup] = useState<Record<string, ParentAccessLookup>>({});
  const [activeAcademicYearLabel, setActiveAcademicYearLabel] = useState<string | null>(school.academic_year_label);
  const [inquiryForm, setInquiryForm] = useState(createInquirySeed);
  const [admissionForm, setAdmissionForm] = useState(createAdmissionSeed);
  const [editingInquiryId, setEditingInquiryId] = useState<string | null>(null);
  const [editingAdmissionId, setEditingAdmissionId] = useState<string | null>(null);
  const [convertingInquiry, setConvertingInquiry] = useState<InquiryRecord | null>(null);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [isAdmissionModalOpen, setIsAdmissionModalOpen] = useState(false);
  const [convertForm, setConvertForm] = useState(createConvertSeed);
  const [busyDeleteInquiryId, setBusyDeleteInquiryId] = useState<string | null>(null);
  const [busyDeleteAdmissionId, setBusyDeleteAdmissionId] = useState<string | null>(null);
  const [busyConvertInquiryId, setBusyConvertInquiryId] = useState<string | null>(null);
  const [generatedAdmissionCredential, setGeneratedAdmissionCredential] = useState<GeneratedAdmissionCredential | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadAdmissions();
  }, [school.id]);

  async function loadAdmissions() {
    setMessage(null);

    try {
      const [inquiryResponse, admissionResponse, studentResponse, studentParentResponse, academicYearResponse] = await Promise.all([
        supabase.from('inquiries').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('admissions').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('students').select('*').eq('school_id', school.id).order('first_name'),
        supabase
          .from('student_parents')
          .select('student_id, is_primary, parents(id, full_name, email, phone_number, user_id, is_active, access_status, access_invited_at, password_reset_sent_at, last_login_at)')
          .eq('school_id', school.id),
        supabase.from('academic_years').select('label').eq('school_id', school.id).eq('is_active', true).order('start_date', { ascending: false }).limit(1),
      ]);

      if (inquiryResponse.error) throw inquiryResponse.error;
      if (admissionResponse.error) throw admissionResponse.error;
      if (studentResponse.error) throw studentResponse.error;
      if (studentParentResponse.error) throw studentParentResponse.error;
      if (academicYearResponse.error) throw academicYearResponse.error;

      const nextStudentParentLookup = ((studentParentResponse.data ?? []) as Array<Record<string, any>>).reduce<Record<string, string>>((accumulator, row) => {
        const studentId = row.student_id as string | undefined;
        const parentName = row.parents?.full_name as string | undefined;

        if (!studentId || !parentName) {
          return accumulator;
        }

        if (row.is_primary || !accumulator[studentId]) {
          accumulator[studentId] = parentName;
        }

        return accumulator;
      }, {});
      const nextStudentParentAccessLookup = ((studentParentResponse.data ?? []) as Array<Record<string, any>>).reduce<Record<string, ParentAccessLookup>>((accumulator, row) => {
        const studentId = row.student_id as string | undefined;
        const parent = row.parents as Record<string, any> | null;

        if (!studentId || !parent?.id) {
          return accumulator;
        }

        if (row.is_primary || !accumulator[studentId]) {
          accumulator[studentId] = {
            id: parent.id,
            fullName: parent.full_name,
            email: parent.email,
            phoneNumber: parent.phone_number,
            userId: parent.user_id,
            isActive: parent.is_active,
            accessStatus: parent.access_status,
            accessInvitedAt: parent.access_invited_at,
            passwordResetSentAt: parent.password_reset_sent_at,
            lastLoginAt: parent.last_login_at,
          };
        }

        return accumulator;
      }, {});

      setInquiries((inquiryResponse.data ?? []) as InquiryRecord[]);
      setAdmissions((admissionResponse.data ?? []) as AdmissionRecord[]);
      setStudents((studentResponse.data ?? []) as StudentRecord[]);
      setStudentParentLookup(nextStudentParentLookup);
      setStudentParentAccessLookup(nextStudentParentAccessLookup);
      setActiveAcademicYearLabel(((academicYearResponse.data ?? [])[0] as { label?: string } | undefined)?.label ?? school.academic_year_label);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  function openCreateInquiryModal() {
    setEditingInquiryId(null);
    setInquiryForm(createInquirySeed());
    setIsInquiryModalOpen(true);
  }

  function openEditInquiryModal(inquiry: InquiryRecord) {
    setEditingInquiryId(inquiry.id);
    setInquiryForm({
      child_name: inquiry.child_name,
      parent_name: inquiry.parent_name,
      parent_email: '',
      phone_number: inquiry.phone_number,
      source: inquiry.source ?? '',
      preferred_start_date: inquiry.preferred_start_date ?? '',
      notes: inquiry.notes ?? '',
      status: inquiry.status,
    });
    setIsInquiryModalOpen(true);
  }

  function closeInquiryModal() {
    setEditingInquiryId(null);
    setInquiryForm(createInquirySeed());
    setIsInquiryModalOpen(false);
  }

  function openCreateAdmissionModal() {
    setEditingAdmissionId(null);
    setAdmissionForm(createAdmissionSeed());
    setGeneratedAdmissionCredential(null);
    setIsAdmissionModalOpen(true);
  }

  function openEditAdmissionModal(admission: AdmissionRecord) {
    setEditingAdmissionId(admission.id);
    setAdmissionForm({
      inquiry_id: admission.inquiry_id ?? '',
      student_id: admission.student_id ?? '',
      student_name: admission.student_id ? studentLookup[admission.student_id] ?? '' : admission.inquiry_id ? inquiryLookup[admission.inquiry_id]?.child_name ?? '' : '',
      parent_name: admission.inquiry_id ? inquiryLookup[admission.inquiry_id]?.parent_name ?? '' : admission.student_id ? studentParentLookup[admission.student_id] ?? '' : '',
      parent_email: admission.student_id ? studentParentAccessLookup[admission.student_id]?.email ?? '' : '',
      phone_number: admission.inquiry_id ? inquiryLookup[admission.inquiry_id]?.phone_number ?? '' : admission.student_id ? studentParentAccessLookup[admission.student_id]?.phoneNumber ?? '' : '',
      dob: '',
      gender: 'other',
      status: admission.status,
      submitted_at: admission.submitted_at ?? '',
      confirmed_at: admission.confirmed_at ?? '',
      waitlist_rank: admission.waitlist_rank ? String(admission.waitlist_rank) : '',
    });
    setIsAdmissionModalOpen(true);
  }

  function closeAdmissionModal() {
    setEditingAdmissionId(null);
    setAdmissionForm(createAdmissionSeed());
    setGeneratedAdmissionCredential(null);
    setIsAdmissionModalOpen(false);
  }

  function openConvertInquiryModal(inquiry: InquiryRecord) {
    const existingAdmission = admissions.find((admission) => admission.inquiry_id === inquiry.id);

    if (existingAdmission?.student_id) {
      setMessage('This inquiry already has a linked admission and student.');
      return;
    }

    setConvertingInquiry(inquiry);
    setConvertForm(createConvertSeed());
    setGeneratedAdmissionCredential(null);
    setMessage(null);
  }

  function closeConvertInquiryModal() {
    setConvertingInquiry(null);
    setConvertForm(createConvertSeed());
  }

  function handleAdmissionInquiryChange(inquiryId: string) {
    const inquiry = inquiries.find((item) => item.id === inquiryId) ?? null;

    setAdmissionForm((current) => ({
      ...current,
      inquiry_id: inquiryId,
      student_name: inquiry?.child_name ?? current.student_name,
      parent_name: inquiry?.parent_name ?? current.parent_name,
      phone_number: inquiry?.phone_number ?? current.phone_number,
    }));
  }

  async function handleInquirySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        child_name: inquiryForm.child_name,
        parent_name: inquiryForm.parent_name,
        phone_number: inquiryForm.phone_number,
        source: inquiryForm.source || null,
        preferred_start_date: inquiryForm.preferred_start_date || null,
        notes: inquiryForm.notes || null,
        status: inquiryForm.status,
      };

      let inquiryId = editingInquiryId;

      if (editingInquiryId) {
        const { error } = await supabase.from('inquiries').update(payload).eq('id', editingInquiryId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('inquiries').insert(payload).select('id').single();
        if (error) throw error;
        inquiryId = data.id as string;
      }

      if (inquiryForm.status === 'converted' && inquiryId) {
        const existingAdmission = admissions.find((admission) => admission.inquiry_id === inquiryId && admission.student_id);

        if (!existingAdmission) {
          const result = await createParentStudentAdmission({
            inquiryId,
            studentName: inquiryForm.child_name,
            parentName: inquiryForm.parent_name,
            parentEmail: inquiryForm.parent_email,
            phoneNumber: inquiryForm.phone_number,
            dob: createPlaceholderDate(),
            gender: 'other',
            status: 'enrolled',
            submittedAt: createPlaceholderDate(),
            confirmedAt: createPlaceholderDate(),
            waitlistRank: '',
            notes: inquiryForm.notes,
          });

          setGeneratedAdmissionCredential({
            parentName: result.parentName,
            email: result.email,
            temporaryPassword: result.temporaryPassword,
          });
        }
      }

      await loadAdmissions();
      closeInquiryModal();
      setMessage(
        inquiryForm.status === 'converted'
          ? 'Inquiry converted. Admission, student, parent, parent credentials and primary link were created automatically.'
          : editingInquiryId
            ? 'Inquiry updated.'
            : 'Inquiry added.',
      );
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function createNextAdmissionNumber() {
    const prefix = `cc${getAcademicYearToken(activeAcademicYearLabel)}`;
    const { data, error } = await supabase
      .from('students')
      .select('admission_number')
      .eq('school_id', school.id)
      .ilike('admission_number', `${prefix}%`);

    if (error) throw error;

    const nextSequence =
      ((data ?? []) as Array<{ admission_number: string | null }>)
        .map((row) => {
          const suffix = row.admission_number?.slice(prefix.length);
          const value = suffix ? Number.parseInt(suffix, 10) : Number.NaN;
          return Number.isFinite(value) ? value : 0;
        })
        .reduce((max, value) => Math.max(max, value), 0) + 1;

    return `${prefix}${String(nextSequence).padStart(2, '0')}`;
  }

  async function createParentStudentAdmission({
    inquiryId,
    studentName,
    parentName,
    parentEmail,
    phoneNumber,
    dob,
    gender,
    status,
    submittedAt,
    confirmedAt,
    waitlistRank,
    notes,
  }: {
    inquiryId?: string | null;
    studentName: string;
    parentName: string;
    parentEmail: string;
    phoneNumber: string;
    dob: string;
    gender: string;
    status: string;
    submittedAt: string;
    confirmedAt: string;
    waitlistRank: string;
    notes?: string | null;
  }) {
    const normalizedEmail = parentEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new Error('Parent email is required to create login credentials.');
    }

    const normalizedStudentName = studentName.trim();
    const normalizedParentName = parentName.trim();
    const normalizedPhoneNumber = phoneNumber.trim();

    if (!normalizedStudentName || !normalizedParentName || !normalizedPhoneNumber) {
      throw new Error('Student name, parent name and phone number are required.');
    }

    const { firstName, lastName } = splitFullName(normalizedStudentName);
    const admissionNumber = await createNextAdmissionNumber();
    const accessInvitedAt = new Date().toISOString();
    const { data: existingParents, error: existingParentError } = await supabase
      .from('parents')
      .select('id, user_id, portal_password')
      .eq('school_id', school.id)
      .ilike('email', normalizedEmail)
      .limit(1);

    if (existingParentError) throw existingParentError;

    const existingParent = (existingParents ?? [])[0] as { id: string; user_id: string | null; portal_password?: string | null } | undefined;
    const temporaryPassword = existingParent?.portal_password ?? generateTemporaryPassword();
    let userId = existingParent?.user_id ?? null;

    let welcomeEmailSent = false;
    let welcomeEmailReason: string | undefined;

    if (!userId) {
      const { user, welcomeEmail } = await createManagedUserAccount(
        normalizedEmail,
        temporaryPassword,
        {
          schoolId: school.id,
          fullName: normalizedParentName,
          phone: normalizedPhoneNumber,
          role: 'parent',
          isActive: true,
        },
        {
          sendWelcomeEmail: true,
          loginUrl: getParentLoginUrl(),
          schoolName: school.name,
        },
      );
      userId = user.id;
      welcomeEmailSent = Boolean(welcomeEmail?.sent);
      welcomeEmailReason = welcomeEmail?.reason;
    }

    const parentPayload = {
      school_id: school.id,
      full_name: normalizedParentName,
      phone_number: normalizedPhoneNumber,
      whatsapp_number: normalizedPhoneNumber,
      email: normalizedEmail,
      address: null,
      emergency_contact_name: normalizedParentName,
      emergency_contact_phone: normalizedPhoneNumber,
      notification_preferences: { channel: 'dashboard' },
      is_active: true,
      user_id: userId,
      access_status: 'invited',
      access_invited_at: existingParent?.user_id ? undefined : accessInvitedAt,
      portal_password: temporaryPassword,
    };

    let parentId = existingParent?.id ?? null;

    if (existingParent) {
      const { error: parentUpdateError } = await supabase.from('parents').update(parentPayload).eq('id', existingParent.id);
      if (parentUpdateError) throw parentUpdateError;
    } else {
      const { data: parent, error: parentError } = await supabase
        .from('parents')
        .insert({
          ...parentPayload,
          access_invited_at: accessInvitedAt,
        })
        .select('id')
        .single();

      if (parentError) throw parentError;
      parentId = parent.id as string;
    }

    if (!parentId || !userId) {
      throw new Error('Parent login could not be prepared for admission conversion.');
    }

    await syncManagedProfile({
      userId,
      schoolId: school.id,
      fullName: normalizedParentName,
      phone: normalizedPhoneNumber,
      role: 'parent',
      isActive: true,
    });

    const { data: existingStudents, error: existingStudentError } = await supabase
      .from('students')
      .select('id, admission_number')
      .eq('school_id', school.id)
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)
      .eq('dob', dob || createPlaceholderDate())
      .limit(1);

    if (existingStudentError) throw existingStudentError;

    const existingStudent = (existingStudents ?? [])[0] as { id: string; admission_number: string } | undefined;
    let studentId = existingStudent?.id ?? null;
    let finalAdmissionNumber = existingStudent?.admission_number ?? admissionNumber;

    if (!existingStudent) {
      const { data: student, error: studentError } = await supabase
        .from('students')
        .insert({
          school_id: school.id,
          first_name: firstName,
          last_name: lastName,
          admission_number: admissionNumber,
          dob: dob || createPlaceholderDate(),
          gender,
          class_id: null,
          section_id: null,
          medical_notes: notes || null,
          allergy_details: null,
          emergency_contact_name: normalizedParentName,
          emergency_contact_phone: normalizedPhoneNumber,
          photo_url: null,
          is_active: true,
        })
        .select('id, admission_number')
        .single();

      if (studentError) throw studentError;
      studentId = student.id as string;
      finalAdmissionNumber = student.admission_number as string;
    }

    if (!studentId) {
      throw new Error('Student profile could not be created for admission conversion.');
    }

    const { error: clearPrimaryError } = await supabase
      .from('student_parents')
      .update({ is_primary: false })
      .eq('school_id', school.id)
      .eq('student_id', studentId)
      .eq('is_primary', true);

    if (clearPrimaryError) throw clearPrimaryError;

    const { error: linkError } = await supabase.from('student_parents').upsert({
      school_id: school.id,
      student_id: studentId,
      parent_id: parentId,
      relationship: 'guardian',
      is_primary: true,
    });

    if (linkError) throw linkError;

    const admissionPayload = {
      school_id: school.id,
      inquiry_id: inquiryId || null,
      student_id: studentId,
      status,
      submitted_at: submittedAt || createPlaceholderDate(),
      confirmed_at: confirmedAt || (status === 'enrolled' ? createPlaceholderDate() : null),
      waitlist_rank: waitlistRank ? Number(waitlistRank) : null,
    };

    const existingAdmission = inquiryId ? admissions.find((admission) => admission.inquiry_id === inquiryId) : null;

    if (existingAdmission) {
      const { error: admissionError } = await supabase.from('admissions').update(admissionPayload).eq('id', existingAdmission.id);
      if (admissionError) throw admissionError;
    } else {
      const { error: admissionError } = await supabase.from('admissions').insert(admissionPayload);
      if (admissionError) throw admissionError;
    }

    if (inquiryId) {
      const { error: inquiryError } = await supabase.from('inquiries').update({ status: 'converted' }).eq('id', inquiryId);
      if (inquiryError) throw inquiryError;
    }

    return { admissionNumber: finalAdmissionNumber, temporaryPassword, email: normalizedEmail, parentName: normalizedParentName, welcomeEmailSent, welcomeEmailReason };
  }

  async function handleAdmissionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const payload = {
        school_id: school.id,
        inquiry_id: admissionForm.inquiry_id || null,
        student_id: admissionForm.student_id || null,
        status: admissionForm.status,
        submitted_at: admissionForm.submitted_at || null,
        confirmed_at: admissionForm.confirmed_at || null,
        waitlist_rank: admissionForm.waitlist_rank ? Number(admissionForm.waitlist_rank) : null,
      };

      if (editingAdmissionId) {
        const { error } = await supabase.from('admissions').update(payload).eq('id', editingAdmissionId);
        if (error) throw error;
      } else {
        const linkedInquiry = admissionForm.inquiry_id ? inquiryLookup[admissionForm.inquiry_id] : null;
        const result = await createParentStudentAdmission({
          inquiryId: admissionForm.inquiry_id || null,
          studentName: admissionForm.student_name || linkedInquiry?.child_name || '',
          parentName: admissionForm.parent_name || linkedInquiry?.parent_name || '',
          parentEmail: admissionForm.parent_email,
          phoneNumber: admissionForm.phone_number || linkedInquiry?.phone_number || '',
          dob: admissionForm.dob,
          gender: admissionForm.gender,
          status: admissionForm.status,
          submittedAt: admissionForm.submitted_at,
          confirmedAt: admissionForm.confirmed_at,
          waitlistRank: admissionForm.waitlist_rank,
          notes: linkedInquiry?.notes ?? null,
        });

        setGeneratedAdmissionCredential({
          parentName: result.parentName,
          email: result.email,
          temporaryPassword: result.temporaryPassword,
          welcomeEmailSent: result.welcomeEmailSent,
          welcomeEmailReason: result.welcomeEmailReason,
        });
      }

      await loadAdmissions();
      if (editingAdmissionId) {
        closeAdmissionModal();
      } else {
        setEditingAdmissionId(null);
        setAdmissionForm(createAdmissionSeed());
        setIsAdmissionModalOpen(false);
      }
      setMessage(editingAdmissionId ? 'Admission record updated.' : 'Admission created. Student, parent, parent login and link were created automatically.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteInquiry(inquiry: InquiryRecord) {
    const confirmed = window.confirm(`Delete inquiry for ${inquiry.child_name}?`);

    if (!confirmed) {
      return;
    }

    setBusyDeleteInquiryId(inquiry.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('inquiries').delete().eq('id', inquiry.id);
      if (error) throw error;

      await loadAdmissions();
      closeInquiryModal();
      setMessage('Inquiry deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteInquiryId(null);
    }
  }

  async function handleDeleteAdmission(admission: AdmissionRecord) {
    const confirmed = window.confirm('Delete this admission record?');

    if (!confirmed) {
      return;
    }

    setBusyDeleteAdmissionId(admission.id);
    setMessage(null);

    try {
      const { error } = await supabase.from('admissions').delete().eq('id', admission.id);
      if (error) throw error;

      await loadAdmissions();
      closeAdmissionModal();
      setMessage('Admission record deleted.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyDeleteAdmissionId(null);
    }
  }

  async function handleConvertSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!convertingInquiry) {
      return;
    }

    setBusyConvertInquiryId(convertingInquiry.id);
    setGeneratedAdmissionCredential(null);
    setMessage(null);

    try {
      const result = await createParentStudentAdmission({
        inquiryId: convertingInquiry.id,
        studentName: convertingInquiry.child_name,
        parentName: convertingInquiry.parent_name,
        parentEmail: convertForm.parent_email,
        phoneNumber: convertingInquiry.phone_number,
        dob: convertForm.dob || createPlaceholderDate(),
        gender: convertForm.gender,
        status: 'enrolled',
        submittedAt: createPlaceholderDate(),
        confirmedAt: createPlaceholderDate(),
        waitlistRank: '',
        notes: convertingInquiry.notes,
      });

      setGeneratedAdmissionCredential({
        parentName: result.parentName,
        email: result.email,
        temporaryPassword: result.temporaryPassword,
        welcomeEmailSent: result.welcomeEmailSent,
        welcomeEmailReason: result.welcomeEmailReason,
      });

      await loadAdmissions();
      closeConvertInquiryModal();
      setMessage(`Inquiry converted with admission number ${result.admissionNumber}. Student, parent, login credentials and primary link were created automatically.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setBusyConvertInquiryId(null);
    }
  }

  const studentLookup = useMemo(
    () =>
      students.reduce<Record<string, string>>((accumulator, student) => {
        accumulator[student.id] = `${student.first_name} ${student.last_name}`;
        return accumulator;
      }, {}),
    [students],
  );

  const inquiryLookup = useMemo(
    () =>
      inquiries.reduce<Record<string, InquiryRecord>>((accumulator, inquiry) => {
        accumulator[inquiry.id] = inquiry;
        return accumulator;
      }, {}),
    [inquiries],
  );

  const inquirySummary = useMemo(
    () => ({
      total: inquiries.length,
      active: inquiries.filter((item) => !['closed', 'converted'].includes(item.status)).length,
      visits: inquiries.filter((item) => item.status === 'visit_scheduled').length,
      converted: inquiries.filter((item) => item.status === 'converted').length,
    }),
    [inquiries],
  );

  const admissionSummary = useMemo(
    () => ({
      total: admissions.length,
      pending: admissions.filter((item) => ['pending_documents', 'onboarding'].includes(item.status)).length,
      waitlisted: admissions.filter((item) => item.status === 'waitlisted').length,
      enrolled: admissions.filter((item) => item.status === 'enrolled').length,
    }),
    [admissions],
  );

  const editingInquiry = editingInquiryId ? inquiries.find((item) => item.id === editingInquiryId) ?? null : null;
  const editingAdmission = editingAdmissionId ? admissions.find((item) => item.id === editingAdmissionId) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admissions"
        title="Track the inquiry to enrollment journey"
        description="Manage leads, waitlist movement, and enrollment records from a cleaner admissions directory."
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary gap-2" onClick={openCreateAdmissionModal} type="button">
              <Plus className="h-4 w-4" />
              Add admission
            </button>
            <button className="button-primary gap-2" onClick={openCreateInquiryModal} type="button">
              <Plus className="h-4 w-4" />
              Add inquiry
            </button>
          </div>
        }
      />
      <ToastMessage message={message} />
      {generatedAdmissionCredential ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Parent temporary password</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {generatedAdmissionCredential.parentName} · {generatedAdmissionCredential.email}
          </p>
          <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-sm text-slate-900">{generatedAdmissionCredential.temporaryPassword}</div>
          <p className="mt-3 text-sm text-slate-500">
            {generatedAdmissionCredential.welcomeEmailSent
              ? 'Welcome email sent with login credentials. Password changes are managed from the Parents page.'
              : `Share this once with the parent. Welcome email was not sent${generatedAdmissionCredential.welcomeEmailReason ? `: ${generatedAdmissionCredential.welcomeEmailReason}` : '.'}`}
          </p>
        </div>
      ) : null}

      <SectionCard
        title="Inquiry pipeline"
        description="A clean view of each lead, parent contact, preferred start date, and current admissions stage."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{inquirySummary.total} total</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{inquirySummary.active} active</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{inquirySummary.visits} visits</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{inquirySummary.converted} converted</span>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: 'student',
              label: 'Student name',
              render: (row) => <span className="font-bold text-slate-900">{row.child_name}</span>,
            },
            { key: 'parent', label: 'Parent name', render: (row) => row.parent_name },
            { key: 'contact', label: 'Phone', render: (row) => row.phone_number || 'Not set' },
            { key: 'source', label: 'Source', render: (row) => row.source || 'Direct inquiry' },
            { key: 'date', label: 'Preferred start', render: (row) => formatDate(row.preferred_start_date) },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            {
              key: 'action',
              label: 'Action',
              render: (row) => {
                const linkedAdmission = admissions.find((admission) => admission.inquiry_id === row.id && admission.student_id);
                const isBusy = busyConvertInquiryId === row.id;

                return (
                  <div className="flex flex-wrap gap-2">
                    <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditInquiryModal(row)} type="button">
                      <PencilLine className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </button>
	                    <button
	                      className="button-primary px-3 py-2 text-xs"
	                      disabled={Boolean(linkedAdmission) || isBusy}
	                      onClick={() => openConvertInquiryModal(row)}
	                      type="button"
	                    >
                      {isBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UserCheck className="mr-1 h-3.5 w-3.5" />}
                      {isBusy ? 'Converting...' : linkedAdmission ? 'Converted' : 'Convert'}
                    </button>
                  </div>
                );
              },
            },
          ]}
          emptyMessage="No inquiries logged yet."
          rows={inquiries}
        />
      </SectionCard>

      <SectionCard
        title="Admission tracker"
        description="See student names, parent names, waitlist position, and final enrollment status from one tracker."
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{admissionSummary.total} total</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{admissionSummary.pending} pending</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{admissionSummary.waitlisted} waitlisted</span>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">{admissionSummary.enrolled} enrolled</span>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: 'student',
              label: 'Student name',
              render: (row) => {
                const linkedInquiry = row.inquiry_id ? inquiryLookup[row.inquiry_id] : null;
                const linkedStudent = row.student_id ? studentLookup[row.student_id] : null;

                return <span className="font-bold text-slate-900">{linkedStudent || linkedInquiry?.child_name || 'Direct admission entry'}</span>;
              },
            },
            {
              key: 'parent',
              label: 'Parent name',
              render: (row) => {
                const linkedInquiry = row.inquiry_id ? inquiryLookup[row.inquiry_id] : null;
                const linkedStudentParent = row.student_id ? studentParentLookup[row.student_id] : null;

                return linkedInquiry?.parent_name || linkedStudentParent || 'Not set';
              },
            },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'submitted', label: 'Submitted', render: (row) => formatDate(row.submitted_at) },
            { key: 'waitlist', label: 'Waitlist', render: (row) => (row.waitlist_rank ? `#${row.waitlist_rank}` : 'Not waitlisted') },
            {
              key: 'action',
              label: 'Action',
              render: (row) => (
                <button className="button-secondary px-3 py-2 text-xs" onClick={() => openEditAdmissionModal(row)} type="button">
                  <PencilLine className="mr-1 h-3.5 w-3.5" />
                  Edit
                </button>
              ),
            },
          ]}
          emptyMessage="No admission records yet."
          rows={admissions}
        />
      </SectionCard>

      <Modal
        description="Capture the student, parent, lead source, and current pipeline status in a clean inquiry record."
        onClose={closeInquiryModal}
        open={isInquiryModalOpen}
        title={editingInquiry ? 'Edit inquiry' : 'Add inquiry'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleInquirySubmit}>
          <div>
            <label className="form-label">Student name</label>
            <input
              className="form-input"
              onChange={(event) => setInquiryForm((current) => ({ ...current, child_name: event.target.value }))}
              required
              value={inquiryForm.child_name}
            />
          </div>
          <div>
            <label className="form-label">Parent name</label>
            <input
              className="form-input"
              onChange={(event) => setInquiryForm((current) => ({ ...current, parent_name: event.target.value }))}
              required
              value={inquiryForm.parent_name}
            />
          </div>
          <div>
            <label className="form-label">Phone number</label>
            <input
              className="form-input"
              onChange={(event) => setInquiryForm((current) => ({ ...current, phone_number: event.target.value }))}
              required
              value={inquiryForm.phone_number}
            />
          </div>
          <div>
            <label className="form-label">Parent email</label>
            <input
              className="form-input"
              onChange={(event) => setInquiryForm((current) => ({ ...current, parent_email: event.target.value }))}
              required={inquiryForm.status === 'converted'}
              type="email"
              value={inquiryForm.parent_email}
            />
          </div>
          <div>
            <label className="form-label">Lead source</label>
            <input className="form-input" onChange={(event) => setInquiryForm((current) => ({ ...current, source: event.target.value }))} value={inquiryForm.source} />
          </div>
          <div>
            <label className="form-label">Preferred start date</label>
            <input
              className="form-input"
              onChange={(event) => setInquiryForm((current) => ({ ...current, preferred_start_date: event.target.value }))}
              type="date"
              value={inquiryForm.preferred_start_date}
            />
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" onChange={(event) => setInquiryForm((current) => ({ ...current, status: event.target.value }))} value={inquiryForm.status}>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="visit_scheduled">Visit scheduled</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Notes</label>
            <textarea className="form-input min-h-28" onChange={(event) => setInquiryForm((current) => ({ ...current, notes: event.target.value }))} value={inquiryForm.notes} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingInquiry ? (
              <button className="button-danger mr-auto gap-2" disabled={busyDeleteInquiryId === editingInquiry.id} onClick={() => void handleDeleteInquiry(editingInquiry)} type="button">
                <Trash2 className="h-4 w-4" />
                {busyDeleteInquiryId === editingInquiry.id ? 'Deleting...' : 'Delete inquiry'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeInquiryModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingInquiry ? 'Save changes' : 'Add inquiry'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        description="Create the admission, student profile, parent profile, primary parent link, and parent login credentials."
        onClose={closeConvertInquiryModal}
        open={Boolean(convertingInquiry)}
        title={convertingInquiry ? `Convert ${convertingInquiry.child_name}` : 'Convert inquiry'}
      >
        {convertingInquiry ? (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleConvertSubmit}>
            <div>
              <label className="form-label">Student name</label>
              <input className="form-input" disabled value={convertingInquiry.child_name} />
            </div>
            <div>
              <label className="form-label">Parent name</label>
              <input className="form-input" disabled value={convertingInquiry.parent_name} />
            </div>
            <div>
              <label className="form-label">Phone number</label>
              <input className="form-input" disabled value={convertingInquiry.phone_number} />
            </div>
            <div>
              <label className="form-label">Parent email</label>
              <input
                className="form-input"
                onChange={(event) => setConvertForm((current) => ({ ...current, parent_email: event.target.value }))}
                required
                type="email"
                value={convertForm.parent_email}
              />
            </div>
            <div>
              <label className="form-label">Student DOB</label>
              <input className="form-input" onChange={(event) => setConvertForm((current) => ({ ...current, dob: event.target.value }))} type="date" value={convertForm.dob} />
            </div>
            <div>
              <label className="form-label">Gender</label>
              <select className="form-input" onChange={(event) => setConvertForm((current) => ({ ...current, gender: event.target.value }))} value={convertForm.gender}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button className="button-secondary" onClick={closeConvertInquiryModal} type="button">
                Cancel
              </button>
              <button className="button-primary gap-2" disabled={busyConvertInquiryId === convertingInquiry.id} type="submit">
                {busyConvertInquiryId === convertingInquiry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                {busyConvertInquiryId === convertingInquiry.id ? 'Converting...' : 'Convert inquiry'}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        description={editingAdmission ? 'Update document collection, onboarding progress, waitlist rank, and final enrollment status.' : 'Create the admission, student profile, parent profile, primary link, and parent login credentials together.'}
        onClose={closeAdmissionModal}
        open={isAdmissionModalOpen}
        title={editingAdmission ? 'Edit admission' : 'Add admission'}
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAdmissionSubmit}>
          <div>
            <label className="form-label">Related inquiry</label>
            <select className="form-input" disabled={Boolean(editingAdmission)} onChange={(event) => handleAdmissionInquiryChange(event.target.value)} value={admissionForm.inquiry_id}>
              <option value="">Select inquiry</option>
              {inquiries.map((inquiry) => (
                <option key={inquiry.id} value={inquiry.id}>
                  {inquiry.child_name} · {inquiry.parent_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Student name</label>
            <input
              className="form-input"
              disabled={Boolean(editingAdmission)}
              onChange={(event) => setAdmissionForm((current) => ({ ...current, student_name: event.target.value }))}
              required={!editingAdmission}
              value={admissionForm.student_name}
            />
          </div>
          <div>
            <label className="form-label">Parent name</label>
            <input
              className="form-input"
              disabled={Boolean(editingAdmission)}
              onChange={(event) => setAdmissionForm((current) => ({ ...current, parent_name: event.target.value }))}
              required={!editingAdmission}
              value={admissionForm.parent_name}
            />
          </div>
          <div>
            <label className="form-label">Parent email</label>
            <input
              className="form-input"
              disabled={Boolean(editingAdmission)}
              onChange={(event) => setAdmissionForm((current) => ({ ...current, parent_email: event.target.value }))}
              required={!editingAdmission}
              type="email"
              value={admissionForm.parent_email}
            />
          </div>
          <div>
            <label className="form-label">Phone number</label>
            <input
              className="form-input"
              disabled={Boolean(editingAdmission)}
              onChange={(event) => setAdmissionForm((current) => ({ ...current, phone_number: event.target.value }))}
              required={!editingAdmission}
              value={admissionForm.phone_number}
            />
          </div>
          <div>
            <label className="form-label">Student DOB</label>
            <input
              className="form-input"
              disabled={Boolean(editingAdmission)}
              onChange={(event) => setAdmissionForm((current) => ({ ...current, dob: event.target.value }))}
              type="date"
              value={admissionForm.dob}
            />
          </div>
          <div>
            <label className="form-label">Gender</label>
            <select
              className="form-input"
              disabled={Boolean(editingAdmission)}
              onChange={(event) => setAdmissionForm((current) => ({ ...current, gender: event.target.value }))}
              value={admissionForm.gender}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="form-label">Status</label>
            <select className="form-input" onChange={(event) => setAdmissionForm((current) => ({ ...current, status: event.target.value }))} value={admissionForm.status}>
              <option value="pending_documents">Pending documents</option>
              <option value="onboarding">Onboarding</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="enrolled">Enrolled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="form-label">Waitlist rank</label>
            <input className="form-input" min={1} onChange={(event) => setAdmissionForm((current) => ({ ...current, waitlist_rank: event.target.value }))} type="number" value={admissionForm.waitlist_rank} />
          </div>
          <div>
            <label className="form-label">Submitted at</label>
            <input className="form-input" onChange={(event) => setAdmissionForm((current) => ({ ...current, submitted_at: event.target.value }))} type="date" value={admissionForm.submitted_at} />
          </div>
          <div>
            <label className="form-label">Confirmed at</label>
            <input className="form-input" onChange={(event) => setAdmissionForm((current) => ({ ...current, confirmed_at: event.target.value }))} type="date" value={admissionForm.confirmed_at} />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 pt-2">
            {editingAdmission ? (
              <button
                className="button-danger mr-auto gap-2"
                disabled={busyDeleteAdmissionId === editingAdmission.id}
                onClick={() => void handleDeleteAdmission(editingAdmission)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
                {busyDeleteAdmissionId === editingAdmission.id ? 'Deleting...' : 'Delete admission'}
              </button>
            ) : null}
            <button className="button-secondary" onClick={closeAdmissionModal} type="button">
              Cancel
            </button>
            <button className="button-primary" type="submit">
              {editingAdmission ? 'Save changes' : 'Add admission'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
