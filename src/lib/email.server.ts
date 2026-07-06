// Server-only email delivery via Resend. Never import from a component or route
// module scope — only from server function / server route handlers (dynamic import).
import { CURRENCY } from "./packages";
import { readServerEnv } from "@/integrations/supabase/env";

const RESEND_URL = "https://api.resend.com/emails";

/** Sender identity — verified domain on Resend. */
export const EMAIL_FROM = "PDF Quanta <support@pdfquanta.online>";
const SUPPORT = "support@pdfquanta.online";
const BRAND = "PDF Quanta";
const SITE = "https://pdfquanta.online";

function resendKey(): string {
  const key = readServerEnv("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  return key;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ id?: string }> {
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo ?? SUPPORT,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, any>;
  if (!res.ok) {
    throw new Error(body?.message || body?.error?.message || `Resend failed (${res.status})`);
  }
  return { id: body?.id };
}

/** Shared branded shell. Content should be pre-escaped / trusted. */
function layout(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1f2233;">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#4f46e5,#6366f1);-webkit-background-clip:text;background-clip:text;color:#4f46e5;">${BRAND}</span>
    </div>
    <div style="background:#ffffff;border-radius:20px;padding:36px 32px;box-shadow:0 12px 40px -16px rgba(79,70,229,0.25);">
      ${inner}
    </div>
    <p style="text-align:center;font-size:12px;color:#8a8fa3;margin-top:24px;line-height:1.6;">
      ${BRAND} · <a href="${SITE}" style="color:#6366f1;text-decoration:none;">pdfquanta.online</a><br>
      Need help? Reply to this email or contact <a href="mailto:${SUPPORT}" style="color:#6366f1;text-decoration:none;">${SUPPORT}</a>
    </p>
  </div>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#6366f1);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 30px;border-radius:12px;">${label}</a>
  </div>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Welcome / registration email (bilingual EN + AR). */
export async function sendWelcomeEmail(to: string, name: string | null): Promise<void> {
  const who = name ? esc(name) : "there";
  const whoAr = name ? esc(name) : "بك";
  const inner = `
    <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;color:#1f2233;">Welcome to ${BRAND}, ${who}! 🎉</h1>
    <p style="font-size:15px;line-height:1.7;color:#4a4f63;margin:0 0 16px;">
      Your account is ready. Chat with PDFs, extract tables, proofread, convert, generate quizzes, and analyze financial or legal documents — all in Arabic &amp; English.
    </p>
    <p style="font-size:15px;line-height:1.7;color:#4a4f63;margin:0 0 4px;">
      You've got starter credits waiting. Jump in and try your first document.
    </p>
    ${button(`${SITE}/dashboard`, "Open your dashboard")}
    <hr style="border:none;border-top:1px solid #eceef5;margin:28px 0;">
    <div dir="rtl" style="text-align:right;">
      <h2 style="font-size:19px;font-weight:800;margin:0 0 6px;color:#1f2233;">مرحبًا ${whoAr} في ${BRAND}! 🎉</h2>
      <p style="font-size:15px;line-height:1.8;color:#4a4f63;margin:0;">
        حسابك جاهز الآن. تحدّث مع ملفات PDF، واستخرج الجداول، ودقّق النصوص، وحوّل الملفات، وأنشئ الاختبارات، وحلّل المستندات المالية والقانونية — بالعربية والإنجليزية. لديك رصيد ترحيبي بانتظارك، ابدأ الآن!
      </p>
    </div>`;
  await sendEmail({ to, subject: `Welcome to ${BRAND} 🎉 | مرحبًا بك في ${BRAND}`, html: layout(inner) });
}

/** Payment invoice / receipt email (bilingual EN + AR). */
export async function sendInvoiceEmail(opts: {
  to: string;
  name?: string | null;
  planNameEn: string;
  planNameAr: string;
  amount: number;
  currency?: string;
  credits: number;
  invoiceId: string;
  kind: string;
}): Promise<void> {
  const cur = opts.currency || CURRENCY;
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const kindLabel = opts.kind === "renewal" ? "Renewal" : "Subscription";
  const row = (l: string, v: string) =>
    `<tr><td style="padding:9px 0;font-size:14px;color:#6b7089;">${l}</td><td style="padding:9px 0;font-size:14px;color:#1f2233;font-weight:600;text-align:right;">${v}</td></tr>`;
  const inner = `
    <h1 style="font-size:22px;font-weight:800;margin:0 0 4px;color:#1f2233;">Payment received ✅</h1>
    <p style="font-size:15px;line-height:1.7;color:#4a4f63;margin:0 0 20px;">
      Thank you${opts.name ? `, ${esc(opts.name)}` : ""}! Your ${esc(opts.planNameEn)} plan is active and your credits have been added.
    </p>
    <div style="background:#f7f8fd;border:1px solid #eceef5;border-radius:14px;padding:18px 20px;">
      <table style="width:100%;border-collapse:collapse;">
        ${row("Invoice", esc(opts.invoiceId))}
        ${row("Date", date)}
        ${row("Plan", `${esc(opts.planNameEn)} (${kindLabel})`)}
        ${row("Credits added", `${opts.credits.toLocaleString()} credits`)}
        <tr><td colspan="2" style="border-top:1px solid #e3e6f2;padding-top:12px;"></td></tr>
        <tr><td style="padding:6px 0;font-size:16px;color:#1f2233;font-weight:800;">Total</td><td style="padding:6px 0;font-size:16px;color:#4f46e5;font-weight:800;text-align:right;">${opts.amount.toLocaleString()} ${esc(cur)}</td></tr>
      </table>
    </div>
    ${button(`${SITE}/dashboard`, "Go to dashboard")}
    <hr style="border:none;border-top:1px solid #eceef5;margin:28px 0;">
    <div dir="rtl" style="text-align:right;">
      <h2 style="font-size:19px;font-weight:800;margin:0 0 6px;color:#1f2233;">تم استلام الدفعة ✅</h2>
      <p style="font-size:15px;line-height:1.8;color:#4a4f63;margin:0;">
        شكرًا لك! تم تفعيل باقة «${esc(opts.planNameAr)}» وإضافة ${opts.credits.toLocaleString()} رصيدًا إلى حسابك. الإجمالي: ${opts.amount.toLocaleString()} ${esc(cur)}. رقم الفاتورة: ${esc(opts.invoiceId)}.
      </p>
    </div>`;
  await sendEmail({
    to: opts.to,
    subject: `Your ${BRAND} invoice — ${opts.amount.toLocaleString()} ${cur} | فاتورتك`,
    html: layout(inner),
  });
}
