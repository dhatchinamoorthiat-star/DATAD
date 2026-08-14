// Cloudflare Pages Function — POST /api/lead
// Emails a signup (name, roll number, email) from the pitch page to
// digitaldoncodes@gmail.com via Brevo. Requires BREVO_API_KEY and
// MAIL_FROM (a Brevo-verified sender email) to be set as environment
// variables on this Cloudflare Pages project (Settings -> Environment
// variables) — this is a separate static deploy from the main DATAD server,
// so it does not inherit that server's .env.

const TO_EMAIL = 'digitaldoncodes@gmail.com';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid JSON' }), { status: 400 });
  }

  const name = String(body.name || '').trim().slice(0, 200);
  const roll = String(body.roll || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().slice(0, 320);

  if (!name || !roll || !email || !email.includes('@')) {
    return new Response(JSON.stringify({ message: 'name, roll, and a valid email are required' }), { status: 400 });
  }

  if (!env.BREVO_API_KEY || !env.MAIL_FROM) {
    return new Response(JSON.stringify({ message: 'Mail is not configured on this deploy' }), { status: 503 });
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.MAIL_FROM_NAME || 'DATAD', email: env.MAIL_FROM },
      to: [{ email: TO_EMAIL }],
      replyTo: { email },
      subject: `DATAD pitch signup — ${name}`,
      htmlContent: `
        <p>New signup from the DATAD pitch page.</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}<br/>
        <strong>Roll number:</strong> ${escapeHtml(roll)}<br/>
        <strong>Email:</strong> ${escapeHtml(email)}</p>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[lead] Brevo send failed', res.status, detail);
    return new Response(JSON.stringify({ message: 'Could not send email' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
