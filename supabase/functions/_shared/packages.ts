export type Plan = {
  id: string;
  price: number;
  credits: number;
  nameEn: string;
  nameAr: string;
};

export const CURRENCY = "SAR";
export const BILLING_INTERVAL_DAYS = 30;

const PLANS: Plan[] = [
  { id: "free", price: 0, credits: 50, nameEn: "Free", nameAr: "مجاني" },
  { id: "basic", price: 19, credits: 500, nameEn: "Basic", nameAr: "أساسي" },
  { id: "pro", price: 49, credits: 1500, nameEn: "Pro", nameAr: "احترافي" },
  { id: "business", price: 99, credits: 5000, nameEn: "Business", nameAr: "أعمال" },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}
