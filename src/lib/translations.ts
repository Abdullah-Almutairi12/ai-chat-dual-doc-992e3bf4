export type Lang = "en" | "ar";

const en = {
  brand: "PDF Chat",
  nav_home: "Home",
  nav_dashboard: "Dashboard",
  nav_login: "Login",
  nav_signup: "Sign up",
  lang_toggle: "العربية",

  hero_title: "Chat with your PDF",
  hero_desc:
    "Upload any document and get instant summaries, insights, and answers through an intelligent chat interface.",
  hero_cta: "Get Started",
  hero_secondary: "See how it works",

  feature_summaries_title: "Instant summaries",
  feature_summaries_desc: "Condense long documents into clear, concise key points in seconds.",
  feature_answers_title: "Ask anything",
  feature_answers_desc: "Get precise answers grounded in the content of your document.",
  feature_insights_title: "Deeper insights",
  feature_insights_desc: "Surface trends, definitions, and hidden details you might miss.",

  dashboard_title: "Your documents",
  dashboard_subtitle: "Upload a PDF to start a conversation.",
  dropzone_text: "Drag & drop your PDF here, or click to browse",
  dropzone_hint: "PDF files up to 20MB",
  history_title: "History",
  history_empty: "No documents yet",
  open_chat: "Open chat",
  uploading: "Uploading…",

  chat_summary_title: "Document summary",
  chat_summary_body:
    "This document covers the main topics, key arguments, and conclusions. Ask a question to dive deeper into any section.",
  chat_placeholder: "Ask a question about this document…",
  chat_empty_title: "Ask your first question",
  chat_empty_desc: "Try “Summarize this document” or “What are the key takeaways?”",
  chat_send: "Send",
  chat_thinking: "Thinking…",
  chat_you: "You",
  chat_assistant: "Assistant",
  back: "Back",

  login_title: "Welcome back",
  login_subtitle: "Sign in to continue to your documents.",
  signup_title: "Create your account",
  signup_subtitle: "Start chatting with your PDFs in seconds.",
  email: "Email",
  password: "Password",
  name: "Full name",
  login_action: "Login",
  signup_action: "Sign up",
  have_account: "Already have an account?",
  no_account: "Don't have an account?",

  footer_rights: "All rights reserved.",
};

const ar: Record<keyof typeof en, string> = {
  brand: "دردشة PDF",
  nav_home: "الرئيسية",
  nav_dashboard: "لوحة التحكم",
  nav_login: "تسجيل الدخول",
  nav_signup: "إنشاء حساب",
  lang_toggle: "English",

  hero_title: "دردش مع ملفات الـ PDF",
  hero_desc:
    "ارفع أي مستند واحصل على ملخصات وإجابات فورية من خلال واجهة محادثة ذكية.",
  hero_cta: "ابدأ الآن",
  hero_secondary: "شاهد كيف يعمل",

  feature_summaries_title: "ملخصات فورية",
  feature_summaries_desc: "لخّص المستندات الطويلة إلى نقاط واضحة ومختصرة في ثوانٍ.",
  feature_answers_title: "اسأل أي شيء",
  feature_answers_desc: "احصل على إجابات دقيقة مستندة إلى محتوى مستندك.",
  feature_insights_title: "رؤى أعمق",
  feature_insights_desc: "اكتشف الاتجاهات والتعريفات والتفاصيل الخفية التي قد تفوتك.",

  dashboard_title: "مستنداتك",
  dashboard_subtitle: "ارفع ملف PDF لبدء المحادثة.",
  dropzone_text: "اسحب وأفلت ملف الـ PDF هنا، أو اضغط للتصفح",
  dropzone_hint: "ملفات PDF حتى 20 ميجابايت",
  history_title: "السجل",
  history_empty: "لا توجد مستندات بعد",
  open_chat: "افتح المحادثة",
  uploading: "جارٍ الرفع…",

  chat_summary_title: "ملخص المستند",
  chat_summary_body:
    "يغطي هذا المستند المواضيع الرئيسية والحجج الأساسية والاستنتاجات. اطرح سؤالاً للتعمق في أي قسم.",
  chat_placeholder: "اطرح سؤالاً حول هذا المستند…",
  chat_empty_title: "اطرح سؤالك الأول",
  chat_empty_desc: "جرّب «لخّص هذا المستند» أو «ما هي النقاط الأساسية؟»",
  chat_send: "إرسال",
  chat_thinking: "يفكّر…",
  chat_you: "أنت",
  chat_assistant: "المساعد",
  back: "رجوع",

  login_title: "مرحبًا بعودتك",
  login_subtitle: "سجّل الدخول للمتابعة إلى مستنداتك.",
  signup_title: "أنشئ حسابك",
  signup_subtitle: "ابدأ الدردشة مع ملفات الـ PDF خلال ثوانٍ.",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  name: "الاسم الكامل",
  login_action: "تسجيل الدخول",
  signup_action: "إنشاء حساب",
  have_account: "لديك حساب بالفعل؟",
  no_account: "ليس لديك حساب؟",

  footer_rights: "جميع الحقوق محفوظة.",
};

export type TranslationKey = keyof typeof en;

export const translations: Record<Lang, Record<TranslationKey, string>> = {
  en,
  ar,
};