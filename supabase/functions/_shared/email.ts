const RESEND_URL = "https://api.resend.com/emails";
const EMAIL_FROM = "PDF Quanta <support@pdfquanta.online>";
const SUPPORT = "support@pdfquanta.online";
const BRAND = "PDF Quanta";
const SITE = "https://pdfquanta.online";

function resendKey(): string {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return key;
}

function layout(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2233;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#4f46e5;">${BRAND}</span>
    </div>
    <div style="background:#ffffff;border-radius:20px;padding:36px 32px;box-shadow:0 12px 40px -16px rgba(79,70,229,0.25);">
      ${inner}
    </div>
    <p style="text-align:center;font-size:12px;color:#8a8fa3;margin-top:24px;line-height:1.6;">
      ${BRAND} · <a href="${SITE}" style="color:#6366f1;text-decoration:none;">pdfquanta.online</a>
    </p>
  </div>
</body></html>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

export async function sendWelcomeEmail(to: string, name: string | null): Promise<void> {
  const who = name ? esc(name) : "there";
  const whoAr = name ? esc(name) : "بك";
  const inner = `
    <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;color:#1f2233;">Welcome to ${BRAND}, ${who}! 🎉</h1>
    <p style="font-size:15px;line-height:1.7;color:#4a4f63;margin:0 0 16px;">
      Your account is ready. Chat with PDFs, extract tables, proofread, convert, and more — in Arabic &amp; English.
    </p>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${SITE}/dashboard" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 30px;border-radius:12px;">Open your dashboard</a>
    </div>
    <hr style="border:none;border-top:1px solid #eceef5;margin:28px 0;">
    <div dir="rtl" style="text-align:right;">
      <h2 style="font-size:19px;font-weight:800;margin:0 0 6px;color:#1f2233;">مرحبًا ${whoAr} في ${BRAND}! 🎉</h2>
      <p style="font-size:15px;line-height:1.8;color:#4a4f63;margin:0;">حسابك جاهز الآن. ابدأ باستخدام أدوات PDF Quanta.</p>
    </div>`;

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject: `Welcome to ${BRAND} 🎉 | مرحبًا بك في ${BRAND}`,
      html: layout(inner),
      reply_to: SUPPORT,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || `Resend failed (${res.status})`);
  }
}
