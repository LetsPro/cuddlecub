import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppContext } from '../../lib/app-context';
import { getErrorMessage, supabase } from '../../lib/supabase';
import { formatDateTime } from '../../lib/utils';
import type { ContentPost, ContentTemplate } from '../../types/app';

const templateSeed = {
  name: '',
  category: 'birthday_post',
  description: '',
};

const postSeed = {
  title: '',
  post_type: 'birthday_post',
  caption: '',
  scheduled_for: '',
  status: 'draft',
};

export function ContentPage() {
  const { school } = useAppContext();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [templateForm, setTemplateForm] = useState(templateSeed);
  const [postForm, setPostForm] = useState(postSeed);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadContent();
  }, [school.id]);

  async function loadContent() {
    setMessage(null);

    try {
      const [templateResponse, postResponse] = await Promise.all([
        supabase.from('content_templates').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
        supabase.from('content_posts').select('*').eq('school_id', school.id).order('created_at', { ascending: false }),
      ]);

      setTemplates((templateResponse.data ?? []) as ContentTemplate[]);
      setPosts((postResponse.data ?? []) as ContentPost[]);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handleTemplateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('content_templates').insert({
        school_id: school.id,
        name: templateForm.name,
        category: templateForm.category,
        description: templateForm.description || null,
      });

      if (error) throw error;
      setTemplateForm(templateSeed);
      await loadContent();
      setMessage('Content template created.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  async function handlePostSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    try {
      const { error } = await supabase.from('content_posts').insert({
        school_id: school.id,
        title: postForm.title,
        post_type: postForm.post_type,
        caption: postForm.caption || null,
        scheduled_for: postForm.scheduled_for || null,
        status: postForm.status,
      });

      if (error) throw error;
      setPostForm(postSeed);
      await loadContent();
      setMessage('Content post saved.');
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content Studio"
        title="Templates and branded school creatives"
        description="Prepare branded templates and posts for birthdays, festivals, events, holiday notices and admission campaigns."
      />

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{message}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Template editor" description="Reusable templates for consistent branded content.">
          <form className="grid gap-4" onSubmit={handleTemplateSubmit}>
            <div>
              <label className="form-label">Template name</label>
              <input className="form-input" onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} value={templateForm.name} />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))} value={templateForm.category}>
                <option value="birthday_post">Birthday post</option>
                <option value="festival_greeting">Festival greeting</option>
                <option value="event_announcement">Event announcement</option>
                <option value="holiday_notice">Holiday notice</option>
                <option value="admission_poster">Admission poster</option>
                <option value="achievement_post">Achievement post</option>
              </select>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-input min-h-28" onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))} value={templateForm.description} />
            </div>
            <button className="button-primary" type="submit">
              Save template
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Create post" description="Create scheduled posts from templates or scratch.">
          <form className="grid gap-4" onSubmit={handlePostSubmit}>
            <div>
              <label className="form-label">Post title</label>
              <input className="form-input" onChange={(event) => setPostForm((current) => ({ ...current, title: event.target.value }))} value={postForm.title} />
            </div>
            <div>
              <label className="form-label">Post type</label>
              <select className="form-input" onChange={(event) => setPostForm((current) => ({ ...current, post_type: event.target.value }))} value={postForm.post_type}>
                <option value="birthday_post">Birthday post</option>
                <option value="festival_greeting">Festival greeting</option>
                <option value="event_announcement">Event announcement</option>
                <option value="holiday_notice">Holiday notice</option>
                <option value="admission_poster">Admission poster</option>
                <option value="annual_day">Annual day creative</option>
                <option value="sports_day">Sports day creative</option>
              </select>
            </div>
            <div>
              <label className="form-label">Caption</label>
              <textarea className="form-input min-h-28" onChange={(event) => setPostForm((current) => ({ ...current, caption: event.target.value }))} value={postForm.caption} />
            </div>
            <div>
              <label className="form-label">Scheduled for</label>
              <input className="form-input" onChange={(event) => setPostForm((current) => ({ ...current, scheduled_for: event.target.value }))} type="datetime-local" value={postForm.scheduled_for} />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-input" onChange={(event) => setPostForm((current) => ({ ...current, status: event.target.value }))} value={postForm.status}>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="ready_to_share">Ready to share</option>
                <option value="published">Published</option>
              </select>
            </div>
            <button className="button-primary" type="submit">
              Save post
            </button>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard title="Template library" description="Reusable assets for school content creation.">
          <DataTable
            columns={[
              { key: 'name', label: 'Template', render: (row) => <span className="font-bold">{row.name}</span> },
              { key: 'category', label: 'Category', render: (row) => <StatusBadge value={row.category} /> },
              { key: 'description', label: 'Description', render: (row) => row.description ?? 'No description' },
            ]}
            emptyMessage="No content templates yet."
            rows={templates}
          />
        </SectionCard>

        <SectionCard
          title="Content pipeline"
          description="Upcoming and published creatives."
          action={
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
              style={{ background: 'rgb(var(--school-primary-rgb) / 0.1)', color: 'var(--school-primary)' }}
            >
              <Sparkles className="h-4 w-4" />
              AI-ready content layer
            </div>
          }
        >
          <DataTable
            columns={[
              { key: 'title', label: 'Title', render: (row) => <span className="font-bold">{row.title}</span> },
              { key: 'type', label: 'Type', render: (row) => <StatusBadge value={row.post_type} /> },
              { key: 'scheduled', label: 'Scheduled', render: (row) => formatDateTime(row.scheduled_for) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            ]}
            emptyMessage="No posts created yet."
            rows={posts}
          />
        </SectionCard>
      </div>
    </div>
  );
}
