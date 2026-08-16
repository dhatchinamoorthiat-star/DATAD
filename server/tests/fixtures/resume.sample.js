/** A fully-populated resume, shared by the PDF tests and manual layout checks. */
module.exports = {
  personal: {
    fullName: 'Priya Sharma',
    email: 'priya@example.edu',
    phone: '+91 98765 43210',
    location: 'Chennai, IN',
    linkedin: 'linkedin.com/in/priyasharma',
    website: 'priya.dev',
  },
  summary:
    'Final-year information systems student with hands-on experience building data pipelines and internal analytics tooling. Comfortable across Python, SQL and React.',
  education: [
    {
      degree: 'B.Tech, Information Technology',
      institution: 'Anna University',
      year: '2022 – 2026',
      score: 'CGPA 8.9',
    },
  ],
  experience: [
    {
      role: 'Data Engineering Intern',
      organization: 'Zoho',
      duration: 'May – Jul 2025',
      description:
        'Built an incremental ingestion job cutting warehouse refresh time from 40 to 6 minutes.\nAutomated schema drift alerts adopted by three downstream teams.',
    },
  ],
  projects: [
    {
      title: 'CampusFlow',
      description: 'Timetable optimiser used by 400 students.',
      technologies: 'React, FastAPI, PostgreSQL',
      link: 'github.com/priya/campusflow',
    },
    {
      title: 'NewsLens',
      description: 'Bias-scoring aggregator over 12 Indian news sources.',
      technologies: 'Python, spaCy',
    },
  ],
  skills: ['Python', 'SQL', 'React', 'Airflow', 'Docker', 'Pandas'],
  certifications: [{ name: 'AWS Cloud Practitioner', issuer: 'Amazon', year: '2025' }],
  achievements: [{ title: 'Winner, Smart India Hackathon', description: 'Top team of 180' }],
  leadership: [
    { title: 'Placement Coordinator', description: 'Ran mock-interview drives for 200 peers' },
  ],
};
