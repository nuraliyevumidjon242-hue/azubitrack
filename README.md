# AzubiTrack

> IHK talablariga mos, sun’iy intellekt yordamida ish kecha–kunduzini raqamlashtiradigan to‘liq stack “Berichtsheft” platformasi.

![Status](https://img.shields.io/badge/status-production%20ready-6b66d9)
![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-2f855a)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-3178c6)
![Tests](https://img.shields.io/badge/tests-64%20passed-22a06b)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Demo

- O‘zaro huquqlarga ega **Azubi** va **Ausbilder** demo sessiyalari
- Haftalik hisobot holatlari: Entwurf, Eingereicht, Abgelehnt, Freigegeben
- AI tomonidan professional nemischa matn optimizatsiyasi
- IHK formati mosligidagi A4 PDF hujjat
- GDPR uchun profil ma’lumotlari eksporti va hisobni o‘chirish

## Asosiy imkoniyatlar

- JWT autentifikatsiya: qisqa muddatli access va refresh tokenlar
- Uch rol: AZUBI, AUSBILDER, demo sessiya
- Haftalik report va uch majburiy IHK kategoriyasi
- Autentifikatsiyalangan huquq nazorati va role-based API
- Access/refresh cookie mexanizmi, bcrypt parol himoyasi
- OpenAI/Gemini/local AI provider va DB/cache fallback
- PDFKit yordamida DIN-A4 taqdimot
- ZIP bilan ma’lumot eksporti
- SQLite development, PostgreSQL production, Redis cache

## Texnologiyalar

| Frontend | Backend | Ma’lumotlar | DevOps |
|---|---|---|---|
| React 18 | Node.js + Express | SQLite / PostgreSQL | Docker Compose |
| TypeScript | Zod + REST API | Redis | GitHub Actions |
| Tailwind CSS | JWT + bcrypt | SQL repositories | Vitest + Supertest |
| React Router | PDFKit | Cascade migration | Vite |
| TanStack Query | OpenAI / Gemini | Refresh tokens | nginx |

## Loyiha tuzilmasi

```text
frontend/src
├── App.tsx
├── main.tsx
└── styles.css

backend/src
├── modules/auth
├── modules/reports
├── modules/ai
├── modules/export
├── modules/demo
├── db/repositories
└── middleware
```

## Ishga tushirish

```bash
npm install
cp .env.example .env
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health: http://localhost:4000/api/health

Docker orqali:

```bash
docker compose up --build
```

Frontend: http://localhost:5173

## Sifat tekshiruvlari

```bash
npm run typecheck
npm test
npm run build
```

Hozirgi holat: **64/64 test** muvaffaqiyatli, frontend/backend typecheck va production build toza.

## API qismidan qisqa

| Metod | Endpoint | Kirish |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/demo` | Public |
| GET | `/api/reports` | AZUBI / AUSBILDER |
| PUT | `/api/reports/:id` | Report egasi azubi |
| PATCH | `/api/reports/:id/submit` | Azubi |
| PATCH | `/api/reports/:id/review` | Biriktirilgan Ausbilder |
| POST | `/api/ai/optimize` | Azubi |
| GET | `/api/reports/:id/pdf` | Ruxsat berilgan tomonlar |

## Xavfsizlik va ma’lumotlar himoyasi

- Barcha login va role amallar serverda tekshirilib cheklanadi
- Shifrlanmagan parol saqlanmaydi
- User ma’lumotlari va reportlar cascade orqali o‘chiriladi
- Refresh tokenlar httpOnly cookie orqali uzatiladi
- AI input/character limiti va cache mavjud

## Portfolio taqdimoti

Loyiha slaydlari: [presentation/index.html](presentation/index.html)

## Muallif

**Umidjon Nuraliyev**

- GitHub: https://github.com/nuraliyevumidjon242-hue
