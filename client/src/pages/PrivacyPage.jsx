import LegalLayout, { LegalSection } from '../components/layout/LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 2026">
      <p>
        DATAD ("the platform") is an independent project built and maintained by a student,
        Dhatchina Moorthi, for use by the batch. This page explains what data the platform
        stores, where it lives, and who can see it. Plain and honest — no legalese padding.
      </p>

      <LegalSection heading="What we store">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Account:</strong> your name, email address, and a securely hashed password (never stored in plain text).</li>
          <li><strong>Content you create:</strong> notes, photos, planner tasks, expenses and income, and your resume.</li>
          <li><strong>Nothing else:</strong> no tracking cookies, no analytics, no advertising identifiers.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Where your data lives">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>MongoDB Atlas</strong> — your account and content (text data).</li>
          <li><strong>Cloudinary</strong> — photos you upload.</li>
          <li><strong>Brevo</strong> — used only to send you account emails (address confirmation, password reset, welcome) and batch announcements; your email address is shared with Brevo solely to deliver those.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Who can see what">
        <ul className="ml-5 list-disc space-y-1">
          <li><strong>Shared with the batch:</strong> notes, photo albums, and planner tasks are visible to every registered user. Only you can edit or delete your own.</li>
          <li><strong>Private to you:</strong> your finances (expenses, income, budget) and your resume are visible only to your own account.</li>
          <li><strong>The admin</strong> can see the list of registered students (names, emails, join dates) and platform totals, and can post announcements. The admin cannot see your private finances or resume.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Your control">
        <p>
          You can change your password or permanently delete your account at any time from{' '}
          <strong>Settings</strong>. Deleting your account immediately and permanently erases all
          of your data — account, notes, photos, tasks, finances and resume — including files
          stored on Cloudinary. This cannot be undone.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about your data? Email{' '}
          <a href="mailto:digitaldoncodes@gmail.com" className="text-indigo-500 hover:underline">
            digitaldoncodes@gmail.com
          </a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}