// Client-safe subscription package catalogue. The server reads prices and
// credit amounts from THIS file — never trust amounts sent by the browser.
export type Plan = {
  id: string;
  price: number; // per billing cycle, in SAR
  credits: number; // credits granted per cycle
  nameEn: string;
  nameAr: string;
  taglineEn: string;
  taglineAr: string;
  featuresEn: string[];
  featuresAr: string[];
  popular?: boolean;
};

export const CURRENCY = "SAR";
export const BILLING_INTERVAL_DAYS = 30;

export const PLANS: Plan[] = [
  {
    id: "free",
    price: 0,
    credits: 50,
    nameEn: "Free",
    nameAr: "مجاني",
    taglineEn: "Get started at no cost",
    taglineAr: "ابدأ مجانًا بدون أي تكلفة",
    featuresEn: ["50 credits to try things out", "Access to all core tools", "Bilingual AI (Arabic & English)"],
    featuresAr: ["50 رصيدًا للتجربة", "الوصول إلى جميع الأدوات الأساسية", "ذكاء اصطناعي ثنائي اللغة (عربي وإنجليزي)"],
  },
  {
    id: "basic",
    price: 19,
    credits: 500,
    nameEn: "Basic",
    nameAr: "أساسي",
    taglineEn: "For light, regular use",
    taglineAr: "للاستخدام الخفيف والمنتظم",
    featuresEn: ["500 credits every month", "All document tools", "Priority processing", "Email support"],
    featuresAr: ["500 رصيد شهريًا", "جميع أدوات المستندات", "معالجة ذات أولوية", "دعم عبر البريد الإلكتروني"],
  },
  {
    id: "pro",
    price: 49,
    credits: 1500,
    popular: true,
    nameEn: "Pro",
    nameAr: "احترافي",
    taglineEn: "Best for power users",
    taglineAr: "الأفضل للمستخدمين المحترفين",
    featuresEn: ["1,500 credits every month", "Everything in Basic", "Faster AI models", "Advanced analyzer & quizzes"],
    featuresAr: ["1,500 رصيد شهريًا", "كل ما في الباقة الأساسية", "نماذج ذكاء اصطناعي أسرع", "محلل متقدم واختبارات ذكية"],
  },
  {
    id: "business",
    price: 99,
    credits: 5000,
    nameEn: "Business",
    nameAr: "أعمال",
    taglineEn: "For teams and heavy workloads",
    taglineAr: "للفرق والأحمال الكبيرة",
    featuresEn: ["5,000 credits every month", "Everything in Pro", "Highest priority queue", "Dedicated support"],
    featuresAr: ["5,000 رصيد شهريًا", "كل ما في الباقة الاحترافية", "أعلى أولوية في المعالجة", "دعم مخصص"],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}