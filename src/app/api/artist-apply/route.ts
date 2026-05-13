import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { name, social } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 });
    }

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPass) {
      console.warn('[artist-apply] GMAIL_USER / GMAIL_APP_PASSWORD not set, skipping email');
      return NextResponse.json({ ok: true });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    await transporter.sendMail({
      from: `"D.FAITH Ecosystem" <${gmailUser}>`,
      to: 'dawid.faith@gmail.com',
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
