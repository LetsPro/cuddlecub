export type AppRole = 'admin' | 'teacher' | 'parent' | 'staff';
export type PortalAccessStatus = 'not_created' | 'invited' | 'active' | 'disabled';

export interface Profile {
  user_id: string;
  school_id: string | null;
  full_name: string | null;
  role: AppRole;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface School {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  academic_year_label: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  settings: Record<string, unknown> | null;
}

export interface MediaAsset {
  id: string;
  school_id: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  media_type: string;
  label: string | null;
  alt_text: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebsitePageContent {
  home_eyebrow: string;
  home_title: string;
  home_subtitle: string;
  home_primary_cta_label: string;
  home_primary_cta_href: string;
  home_secondary_cta_label: string;
  home_secondary_cta_href: string;
  about_eyebrow: string;
  about_title: string;
  about_summary: string;
  about_story: string;
  about_mission: string;
  about_vision: string;
  about_points: string[];
  programs_eyebrow: string;
  programs_title: string;
  programs_intro: string;
  gallery_eyebrow: string;
  gallery_title: string;
  gallery_intro: string;
  footer_tagline: string;
  footer_address: string | null;
  footer_phone: string | null;
  footer_email: string | null;
}

export interface WebsiteHeroSlide {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string;
  sort_order: number;
  is_active: boolean;
}

export interface WebsiteProgram {
  id: string;
  title: string;
  age_range: string | null;
  schedule: string | null;
  summary: string;
  highlights: string[];
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface WebsiteGalleryItem {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  image_url: string;
  sort_order: number;
  is_featured: boolean;
}

export interface PublicWebsiteData {
  school: School;
  page: Partial<WebsitePageContent>;
  slides: WebsiteHeroSlide[];
  programs: WebsiteProgram[];
  gallery: WebsiteGalleryItem[];
}

export interface AcademicYear {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export interface SchoolClass {
  id: string;
  name: string;
  age_group: string | null;
  capacity: number | null;
  class_teacher_staff_id?: string | null;
  section_count?: number;
}

export interface Section {
  id: string;
  class_id: string;
  name: string;
  room_label: string | null;
  capacity: number | null;
}

export interface ParentRecord {
  id: string;
  user_id?: string | null;
  full_name: string;
  phone_number: string;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notification_preferences: Record<string, unknown> | null;
  is_active: boolean;
  access_status?: PortalAccessStatus | null;
  access_invited_at?: string | null;
  password_reset_sent_at?: string | null;
  last_login_at?: string | null;
  portal_password?: string | null;
}

export interface StaffRecord {
  id: string;
  user_id?: string | null;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  designation: string;
  role: string;
  photo_url: string | null;
  is_active: boolean;
  permissions: string[] | null;
  class_teacher_for: string | null;
  dob?: string | null;
  access_status?: PortalAccessStatus | null;
  access_invited_at?: string | null;
  password_reset_sent_at?: string | null;
  last_login_at?: string | null;
  portal_password?: string | null;
}

export interface StudentRecord {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  dob: string;
  gender: string;
  photo_url: string | null;
  class_id: string | null;
  section_id: string | null;
  medical_notes: string | null;
  allergy_details: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_active: boolean;
  class_name?: string;
  section_name?: string;
  parent_names?: string[];
}

export interface InquiryRecord {
  id: string;
  child_name: string;
  parent_name: string;
  phone_number: string;
  source: string | null;
  status: string;
  preferred_start_date: string | null;
  notes: string | null;
}

export interface AdmissionRecord {
  id: string;
  inquiry_id: string | null;
  student_id: string | null;
  status: string;
  submitted_at: string | null;
  confirmed_at: string | null;
  waitlist_rank: number | null;
}

export interface TimetableEntry {
  id: string;
  class_id: string;
  section_id: string | null;
  weekday: string;
  start_time: string;
  end_time: string;
  title: string;
  category: string | null;
}

export interface ClassroomUpdate {
  id: string;
  class_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  published_at: string;
}

export interface LessonPlan {
  id: string;
  class_id: string;
  section_id: string | null;
  lesson_date: string;
  title: string;
  objective: string | null;
  activity_details: string | null;
  attachment_url: string | null;
}

export interface WorksheetRecord {
  id: string;
  class_id: string;
  section_id: string | null;
  title: string;
  file_url: string;
  uploaded_at: string;
}

export interface HomeworkTask {
  id: string;
  class_id: string;
  section_id: string | null;
  created_by_staff_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
}

export interface StudentProgressNote {
  id: string;
  student_id: string;
  created_by_staff_id: string | null;
  note_type: string;
  title: string;
  summary: string;
  shared_with_parent: boolean;
  created_at: string;
}

export interface StudentAttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string;
  status: string;
  late_minutes: number | null;
  note: string | null;
}

export interface StaffAttendanceRecord {
  id: string;
  staff_id: string;
  attendance_date: string;
  status: string;
  late_minutes: number | null;
  note: string | null;
}

export interface DailyActivityRecord {
  id: string;
  student_id: string;
  activity_date: string;
  activity_type: string;
  summary: string;
  image_url?: string | null;
  details: string | null;
  status: string | null;
  shared_with_parent?: boolean;
}

export interface FeeStructure {
  id: string;
  name: string;
  billing_cycle: string;
  total_amount: number;
  due_day: number | null;
  is_active: boolean;
}

export interface FeeInvoice {
  id: string;
  student_id: string;
  fee_structure_id: string | null;
  invoice_number: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  receipt_number?: string | null;
  installment_plan?: Array<{ label: string; due_date: string; amount: number }> | null;
  created_at?: string;
}

export interface FeePayment {
  id: string;
  fee_invoice_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  status: string;
  installment_label?: string | null;
}

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  channel: string;
  audience: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  attachment_url: string | null;
}

export interface StaffRequest {
  id: string;
  school_id: string;
  staff_id: string;
  student_id: string | null;
  category: string;
  title: string;
  message: string;
  file_url: string | null;
  status: string;
  priority: string;
  created_at: string;
}

export interface ParentRequest {
  id: string;
  school_id: string;
  parent_id: string;
  student_id: string | null;
  category: string;
  title: string;
  message: string;
  requested_for: string | null;
  status: string;
  pickup_person_name: string | null;
  pickup_person_phone: string | null;
  response_message: string | null;
  response_by_name: string | null;
  response_by_role: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface ContentTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
}

export interface ContentPost {
  id: string;
  title: string;
  post_type: string;
  caption: string | null;
  scheduled_for: string | null;
  status: string;
}

export interface EventRecord {
  id: string;
  title: string;
  event_type: string;
  start_at: string;
  end_at: string | null;
  target_audience: string | null;
  description: string | null;
}

export interface DashboardMetrics {
  totalStudents: number;
  totalStaff: number;
  totalParents: number;
  todayStudentAttendance: number;
  todayStaffAttendance: number;
  pendingInvoices: number;
  activityUpdates: number;
}
