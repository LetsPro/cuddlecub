import { BriefcaseBusiness, Building2, Lightbulb, UserRound } from 'lucide-react';

const managementMembers = [
  {
    name: 'Hemashree K',
    role: 'Founder, MD',
    description: 'Clinical psychologist, Entrepreneur, Corporate Trainer.',
    icon: UserRound,
  },
  {
    name: 'Yashas R.',
    role: 'Co-Founder, CEO',
    description: 'Entrepreneur, Founder of Dayanandamai Event planners.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Pushpalatha R.',
    role: 'Director of Cuddle Cub International Preschool',
    description: 'President, Jnaanajyoti Educational Trust. Renowned artist.',
    icon: Building2,
  },
  {
    name: 'Ghanavanth K',
    role: 'Business Development Officer',
    description: 'Business development officer of Cuddle Cub International Preschool, Tech Engineer.',
    icon: Lightbulb,
  },
];

export function ManagementPanelSection() {
  return (
    <section className="mx-auto max-w-[1400px] space-y-6">
      <div className="text-center">
        <div className="kids-badge">
          <BriefcaseBusiness className="h-4 w-4" />
          Management Panel
        </div>
        <h2 className="mt-4 font-serif text-3xl sm:text-4xl">Leadership behind the school</h2>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-slate-600">
          The management team brings together education, psychology, entrepreneurship, creative leadership, and technology experience.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {managementMembers.map((member) => {
          const Icon = member.icon;

          return (
            <article key={member.name} className="kids-bubble-card p-6">
              <div className="theme-icon-gradient flex h-12 w-12 items-center justify-center rounded-[1.2rem] text-white">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-5 text-xl font-extrabold text-slate-900">{member.name}</p>
              <p className="mt-2 text-sm font-semibold theme-text-primary">{member.role}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{member.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
