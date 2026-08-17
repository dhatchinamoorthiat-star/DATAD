import LegalLayout, { LegalSection } from '../components/layout/LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" updated="July 2026">
      <p>
        By creating an account on DATAD, you agree to these simple terms. This is a free,
        student-run platform for a student batch — please use it in good faith.
      </p>

      <LegalSection heading="Acceptable use">
        <ul className="ml-5 list-disc space-y-1">
          <li>Don&rsquo;t upload content that is illegal, harmful, or infringes someone else&rsquo;s rights.</li>
          <li>Don&rsquo;t upload anything that isn&rsquo;t yours to share, or that others in the batch would not consent to.</li>
          <li>Don&rsquo;t attempt to break, overload, or gain unauthorised access to the platform or other users&rsquo; data.</li>
          <li>Shared spaces (notes, photos, planner) are for the batch — keep them respectful.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You own what you create. You&rsquo;re responsible for the content you post, and you grant the
          platform permission to store and display it so the intended people (you, or your batch)
          can see it. You can delete your content — or your whole account — at any time.
        </p>
      </LegalSection>

      <LegalSection heading="Contributions">
        <p>
          Support contributions are voluntary and go toward hosting, storage and domain costs.
          They are not purchases and are non-refundable. They don&rsquo;t unlock paid features — the
          platform is free for the batch.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty">
        <p>
          The platform is provided &ldquo;as is&rdquo;, without guarantees of uptime or that data will never
          be lost. Keep your own backups of anything important (for example, export your resume as
          a PDF). The maintainer isn&rsquo;t liable for any loss arising from use of the platform.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          These terms may be updated as the platform grows. Continued use after a change means you
          accept the updated terms. Questions?{' '}
          <a href="mailto:digitaldoncodes@gmail.com" className="text-indigo-500 hover:underline">
            digitaldoncodes@gmail.com
          </a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}