import { NextResponse } from 'next/server';
import { sendMail, ADMIN_EMAIL } from '@/app/lib/email';

export async function POST(req: Request) {
  try {
    const { name, email, social } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }
    if (!email?.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    await sendMail({
      to: ADMIN_EMAIL,
      fromName: 'D.FAITH Ecosystem',
      subject: `Neue Künstler-Bewerbung: ${name.trim()}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;padding:24px;background:#0a0908;color:#fff;border-radius:12px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#fbbf24">Neue Künstler-Bewerbung</h2>
          <p style="margin:0 0 20px;color:#a1a1aa;font-size:13px">D.FAITH Ecosystem</p>
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em;width:80px">Name</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px;font-weight:700">${name.trim()}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em">E-Mail</td>
              <td style="padding:10px 0;border-bottom:1px solid #27272a;color:#fff;font-size:14px"><a href="mailto:${email.trim()}" style="color:#fbbf24;text-decoration:none">${email.trim()}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#71717a;font-size:11px;text-transform:uppercase;letter-spacing:.1em">Social</td>
              <td style="padding:10px 0;color:#fbbf24;font-size:14px">${social?.trim() || '—'}</td>
            </tr>
          </table>
        </div>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[artist-apply]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
