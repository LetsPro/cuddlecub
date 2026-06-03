import { BriefcaseBusiness } from 'lucide-react';

const managementMembers = [
  {
    name: 'Ms Hemashree K',
    image: '/management/ms-hemashree-k.jpg',
    role: 'Founder, MD',
    description: 'Clinical psychologist, Entrepreneur, Corporate Trainer.',
  },
  {
    name: 'Mr Yashas',
    image: '/management/mr-yashas.jpg',
    role: 'Co-Founder, CEO',
    description: 'Entrepreneur, Founder of Dayanandamai Event planners.',
  },
  {
    name: 'Smt Pushpalatha',
    image: '/management/smt-pushpalatha.jpg',
    role: 'Director of Cuddle Cub International Preschool',
    description: 'President, Jnaanajyoti Educational Trust. Renowned artist.',
  },
  {
    name: 'Mr Ghanavanth',
    image: '/management/mr-ghanavanth.jpg',
    role: 'Business Development Officer',
    description: 'Business development officer of Cuddle Cub International Preschool, Software Engineer.',
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
        {managementMembers.map((member) => (
          <article key={member.name} className="kids-bubble-card h-full overflow-hidden p-0">
            <div className="h-72 w-full bg-slate-100">
              <img src={member.image} alt={member.name} className="h-full w-full object-cover object-top" loading="lazy" />
            </div>
            <div className="p-6">
              <p className="mt-5 text-xl font-extrabold text-slate-900">{member.name}</p>
              <p className="mt-2 text-sm font-semibold theme-text-primary">{member.role}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{member.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
