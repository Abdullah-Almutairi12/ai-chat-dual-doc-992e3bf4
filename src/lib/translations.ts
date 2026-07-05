export type Lang = "en" | "ar";

const en = {
  brand: "PDF Quanta",
  tagline: "The Quantum Leap in Document Intelligence",
  slogan: "The Quantum Leap in Document Intelligence",
  lang_toggle: "العربية",

  nav_home: "Home",
  nav_features: "Features",
  nav_dashboard: "Dashboard",
  nav_login: "Login",
  nav_admin: "Admin",
  nav_signup: "Sign up",
  nav_pricing: "Pricing",
  nav_account: "Account",
  nav_logout: "Sign out",
  free_trial_remaining: "Free Credits Remaining",
  free_trial_used: "Free trial used",
  free_trial_unlimited: "Unlimited access",
  upgrade_modal_title: "You've used your free file",
  upgrade_modal_desc:
    "Your free trial includes one complete PDF — chat, tables, proofreading and more. Upgrade to a plan to keep processing unlimited documents.",
  upgrade_modal_perk_1: "Process unlimited PDFs every month",
  upgrade_modal_perk_2: "Full access to every AI tool",
  upgrade_modal_perk_3: "Priority processing & secure payments via Tap",
  upgrade_modal_cta: "Upgrade now",
  upgrade_modal_later: "Maybe later",
  free_limit_reached: "You've used your free file. Upgrade to continue.",

  // hero
  hero_badge: "AI-powered · Bilingual",
  hero_title: "Your intelligent document workspace",
  hero_desc:
    "Chat with PDFs, extract tables, proofread, convert, generate quizzes, and analyze financial or legal documents — all in one bilingual AI suite.",
  hero_cta: "Get Started",
  hero_secondary: "Explore features",

  features_title: "Six powerful tools, one workspace",
  features_subtitle: "Everything you need to work smarter with documents.",

  // tool titles
  tool_chat: "Chat & Summary",
  tool_tables: "Table & Excel Extractor",
  tool_proofreader: "Proofreader & Smart Editor",
  tool_converter: "Smart Document Converter",
  tool_quiz: "AI Quiz Generator",
  tool_analyzer: "Financial & Legal Analyzer",

  // tool short descriptions
  tool_chat_desc: "Ask questions and get instant answers grounded in your PDF.",
  tool_tables_desc: "Detect tables in any PDF and export them to clean Excel files.",
  tool_proofreader_desc: "Catch grammar and spelling mistakes in Arabic and English.",
  tool_converter_desc: "Convert PDF to Word or run OCR on scanned documents.",
  tool_quiz_desc: "Turn any document into an interactive quiz with instant scoring.",
  tool_analyzer_desc: "Extract key metrics into charts and flag risky legal clauses.",

  // sidebar
  sidebar_tools: "Tools",
  sidebar_library: "Library",
  history_title: "Recent documents",
  history_empty: "No documents yet",

  // dashboard
  dashboard_title: "Dashboard",
  dashboard_welcome: "Choose a tool to get started.",
  open_tool: "Open",

  // dropzone
  dropzone_text: "Drag & drop your PDF here, or click to browse",
  dropzone_hint: "PDF files up to 20MB",
  dropzone_replace: "Replace file",
  invalid_file: "Please upload a valid file",
  uploaded: "Document uploaded",

  // chat tool
  chat_summary_title: "Document summary",
  chat_summary_body:
    "This document covers the main topics, key arguments, and conclusions. Ask a question to dive deeper into any section.",
  chat_placeholder: "Ask a question about this document…",
  chat_empty_title: "Ask your first question",
  chat_empty_desc: "Try “Summarize this document” or “What are the key takeaways?”",
  chat_send: "Send",

  // extraction / OCR
  extracting: "Extracting text…",
  ocr_running: "Reading scanned pages with OCR…",
  extract_failed: "Couldn't read this document. Please try another file.",
  extract_empty: "No readable text was found in this document.",
  ocr_badge: "Text recovered via OCR",
  text_layer_badge: "Text extracted",
  pages_label: "pages",
  summary_generating: "Generating summary…",
  chat_need_login: "Please sign in to chat with your document.",
  chat_rate_limit: "Too many requests — please wait a moment and try again.",
  chat_no_credits: "AI credits are exhausted. Please add credits to continue.",
  chat_error: "Something went wrong. Please try again.",

  // tables tool
  tables_detected: "Detected tables",
  tables_scan: "Scanning document for tables…",
  tables_download: "Download Excel",
  tables_downloaded: "Excel file downloaded",
  tables_hint: "AI found the following tables. Download them as a formatted .xlsx file.",

  // proofreader
  proof_scan: "Analyzing text…",
  proof_issues: "Issues found",
  proof_no_issues: "No issues found",
  proof_original: "Original text",
  proof_rewrite: "Professional rewrite",
  proof_apply: "Apply rewrite",
  proof_applied: "Rewrite applied",
  proof_error_spelling: "Spelling",
  proof_error_grammar: "Grammar",
  proof_error_style: "Style",

  // converter
  convert_target: "Convert to",
  convert_word: "PDF → Word",
  convert_ocr: "OCR (scanned → text)",
  convert_run: "Convert now",
  convert_processing: "Converting…",
  convert_done: "Conversion complete",
  convert_download: "Download result",
  convert_ocr_note: "Optimized for accurate Arabic character recognition.",
  convert_result_title: "Result preview",
  convert_layout: "Layout-preserving",
  convert_layout_note:
    "Keeps the exact visual design — tables, columns, images and Arabic text stay in their original positions.",
  convert_layout_building: "Rebuilding layout…",
  convert_layout_hint: "Scroll to review every page. Text stays selectable over the original design.",
  convert_download_html: "Download HTML (layout)",

  // quiz
  quiz_generate: "Generate quiz",
  quiz_generating: "Generating questions…",
  quiz_type: "Question type",
  quiz_mcq: "Multiple choice",
  quiz_tf: "True / False",
  quiz_submit: "Submit answers",
  quiz_retry: "Try again",
  quiz_score: "Your score",
  quiz_correct: "Correct",
  quiz_incorrect: "Incorrect",
  quiz_true: "True",
  quiz_false: "False",

  // analyzer
  analyzer_metrics: "Key metrics",
  analyzer_chart_title: "Financial overview",
  analyzer_flags: "Flagged clauses",
  analyzer_flags_hint: "Sensitive legal clauses and hidden penalties detected.",
  analyzer_revenue: "Revenue",
  analyzer_expenses: "Expenses",
  analyzer_profit: "Net profit",
  analyzer_debt: "Total debt",
  analyzer_high: "High risk",
  analyzer_medium: "Medium risk",
  analyzer_scan: "Analyzing document…",

  // auth
  login_title: "Welcome back",
  login_subtitle: "Sign in to continue to your workspace.",
  signup_title: "Create your account",
  signup_subtitle: "Start working smarter with your documents.",
  email: "Email",
  password: "Password",
  name: "Full name",
  login_action: "Login",
  signup_action: "Sign up",
  have_account: "Already have an account?",
  no_account: "Don't have an account?",
  auth_soon: "Authentication coming soon",

  back: "Back",
  footer_rights: "All rights reserved.",
};

const ar: Record<keyof typeof en, string> = {
  brand: "PDF Quanta",
  tagline: "القفزة النوعية في ذكاء المستندات",
  slogan: "القفزة النوعية في ذكاء المستندات",
  lang_toggle: "English",

  nav_home: "الرئيسية",
  nav_features: "المميزات",
  nav_dashboard: "لوحة التحكم",
  nav_login: "تسجيل الدخول",
  nav_admin: "الإدارة",
  nav_signup: "إنشاء حساب",
  nav_pricing: "الباقات",
  nav_account: "الحساب",
  nav_logout: "تسجيل الخروج",

  hero_badge: "مدعوم بالذكاء الاصطناعي · ثنائي اللغة",
  hero_title: "مساحة عملك الذكية للمستندات",
  hero_desc:
    "دردش مع ملفات PDF، واستخرج الجداول، وصحّح لغويًا، وحوّل الصيغ، وأنشئ الاختبارات، وحلّل المستندات المالية والقانونية — كل ذلك في منصة ذكية واحدة ثنائية اللغة.",
  hero_cta: "ابدأ الآن",
  hero_secondary: "استكشف الميزات",

  features_title: "ست أدوات قوية في منصة واحدة",
  features_subtitle: "كل ما تحتاجه للعمل بذكاء مع مستنداتك.",

  tool_chat: "المحادثة والتلخيص",
  tool_tables: "مستخرج الجداول",
  tool_proofreader: "المصحح والمراجع اللغوي",
  tool_converter: "محول الصيغ الذكي",
  tool_quiz: "منشئ الاختبارات التلقائي",
  tool_analyzer: "المحلل المالي والقانوني",

  tool_chat_desc: "اطرح الأسئلة واحصل على إجابات فورية مستندة إلى ملفك.",
  tool_tables_desc: "اكتشف الجداول في أي ملف PDF وصدّرها إلى ملفات Excel نظيفة.",
  tool_proofreader_desc: "اكتشف الأخطاء النحوية والإملائية بالعربية والإنجليزية.",
  tool_converter_desc: "حوّل PDF إلى Word أو نفّذ OCR على المستندات الممسوحة.",
  tool_quiz_desc: "حوّل أي مستند إلى اختبار تفاعلي مع تصحيح فوري.",
  tool_analyzer_desc: "استخرج المؤشرات في رسوم بيانية وحدّد البنود القانونية الخطرة.",

  sidebar_tools: "الأدوات",
  sidebar_library: "المكتبة",
  history_title: "المستندات الأخيرة",
  history_empty: "لا توجد مستندات بعد",

  dashboard_title: "لوحة التحكم",
  dashboard_welcome: "اختر أداة للبدء.",
  open_tool: "افتح",

  dropzone_text: "اسحب وأفلت ملف الـ PDF هنا، أو اضغط للتصفح",
  dropzone_hint: "ملفات PDF حتى 20 ميجابايت",
  dropzone_replace: "استبدال الملف",
  invalid_file: "الرجاء رفع ملف صالح",
  uploaded: "تم رفع المستند",

  chat_summary_title: "ملخص المستند",
  chat_summary_body:
    "يغطي هذا المستند المواضيع الرئيسية والحجج الأساسية والاستنتاجات. اطرح سؤالاً للتعمق في أي قسم.",
  chat_placeholder: "اطرح سؤالاً حول هذا المستند…",
  chat_empty_title: "اطرح سؤالك الأول",
  chat_empty_desc: "جرّب «لخّص هذا المستند» أو «ما هي النقاط الأساسية؟»",
  chat_send: "إرسال",

  extracting: "جارٍ استخراج النص…",
  ocr_running: "جارٍ قراءة الصفحات الممسوحة عبر OCR…",
  extract_failed: "تعذّر قراءة هذا المستند. الرجاء تجربة ملف آخر.",
  extract_empty: "لم يتم العثور على نص قابل للقراءة في هذا المستند.",
  ocr_badge: "تم استخراج النص عبر OCR",
  text_layer_badge: "تم استخراج النص",
  pages_label: "صفحات",
  summary_generating: "جارٍ إنشاء الملخص…",
  chat_need_login: "الرجاء تسجيل الدخول للدردشة مع مستندك.",
  chat_rate_limit: "طلبات كثيرة — الرجاء الانتظار قليلاً ثم المحاولة مجددًا.",
  chat_no_credits: "انتهى رصيد الذكاء الاصطناعي. الرجاء إضافة رصيد للمتابعة.",
  chat_error: "حدث خطأ ما. الرجاء المحاولة مرة أخرى.",

  tables_detected: "الجداول المكتشفة",
  tables_scan: "جارٍ فحص المستند بحثًا عن الجداول…",
  tables_download: "تنزيل Excel",
  tables_downloaded: "تم تنزيل ملف Excel",
  tables_hint: "اكتشف الذكاء الاصطناعي الجداول التالية. نزّلها كملف .xlsx منسّق.",

  proof_scan: "جارٍ تحليل النص…",
  proof_issues: "الأخطاء المكتشفة",
  proof_no_issues: "لا توجد أخطاء",
  proof_original: "النص الأصلي",
  proof_rewrite: "إعادة صياغة احترافية",
  proof_apply: "تطبيق الصياغة",
  proof_applied: "تم تطبيق الصياغة",
  proof_error_spelling: "إملائي",
  proof_error_grammar: "نحوي",
  proof_error_style: "أسلوب",

  convert_target: "التحويل إلى",
  convert_word: "PDF ← Word",
  convert_ocr: "OCR (ممسوح ← نص)",
  convert_run: "حوّل الآن",
  convert_processing: "جارٍ التحويل…",
  convert_done: "اكتمل التحويل",
  convert_download: "تنزيل النتيجة",
  convert_ocr_note: "محسّن للتعرف الدقيق على الحروف العربية.",
  convert_result_title: "معاينة النتيجة",
  convert_layout: "الحفاظ على التصميم",
  convert_layout_note:
    "يحافظ على التصميم المرئي تمامًا — الجداول والأعمدة والصور والنص العربي تبقى في مواضعها الأصلية.",
  convert_layout_building: "جارٍ إعادة بناء التصميم…",
  convert_layout_hint: "مرّر لمراجعة كل صفحة. يبقى النص قابلًا للتحديد فوق التصميم الأصلي.",
  convert_download_html: "تنزيل HTML (بالتصميم)",

  quiz_generate: "أنشئ الاختبار",
  quiz_generating: "جارٍ إنشاء الأسئلة…",
  quiz_type: "نوع الأسئلة",
  quiz_mcq: "اختيار من متعدد",
  quiz_tf: "صح / خطأ",
  quiz_submit: "إرسال الإجابات",
  quiz_retry: "حاول مجددًا",
  quiz_score: "نتيجتك",
  quiz_correct: "صحيح",
  quiz_incorrect: "خطأ",
  quiz_true: "صح",
  quiz_false: "خطأ",

  analyzer_metrics: "المؤشرات الرئيسية",
  analyzer_chart_title: "نظرة مالية عامة",
  analyzer_flags: "البنود المحددة",
  analyzer_flags_hint: "تم اكتشاف بنود قانونية حساسة وغرامات مخفية.",
  analyzer_revenue: "الإيرادات",
  analyzer_expenses: "المصروفات",
  analyzer_profit: "صافي الربح",
  analyzer_debt: "إجمالي الديون",
  analyzer_high: "خطورة عالية",
  analyzer_medium: "خطورة متوسطة",
  analyzer_scan: "جارٍ تحليل المستند…",

  login_title: "مرحبًا بعودتك",
  login_subtitle: "سجّل الدخول للمتابعة إلى مساحة عملك.",
  signup_title: "أنشئ حسابك",
  signup_subtitle: "ابدأ العمل بذكاء مع مستنداتك.",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  name: "الاسم الكامل",
  login_action: "تسجيل الدخول",
  signup_action: "إنشاء حساب",
  have_account: "لديك حساب بالفعل؟",
  no_account: "ليس لديك حساب؟",
  auth_soon: "المصادقة قريبًا",

  back: "رجوع",
  footer_rights: "جميع الحقوق محفوظة.",
};

export type TranslationKey = keyof typeof en;

export const translations: Record<Lang, Record<TranslationKey, string>> = { en, ar };
