# LorryCare Pro

Separate frontend + backend starter for a professional lorry repair/service and service-booking website.

## Folder structure

- `frontend/` — public website, admin UI and printable A4 job card.
- `backend/` — Node.js + Express API + Firebase Admin SDK.

## Backend setup

1. Install Node.js.
2. Open a terminal in `backend`.
3. Run `npm install`.
4. Create `.env` from `.env.example`.
5. Create/download a Firebase Admin SDK service-account key for the project and keep it ONLY on the backend. Never upload it to GitHub/Vercel frontend.
6. Set `GOOGLE_APPLICATION_CREDENTIALS` to the service-account JSON path.
7. Run `npm run dev`.

## Frontend setup

1. Open `frontend/config.js`.
2. Put your Firebase Web App config in it.
3. Set `API_BASE_URL` to the backend URL.
4. Serve `frontend` through a local web server (for example VS Code Live Server), not `file://`.
5. For admin pages, use Firebase Email/Password Authentication.

## Production security

The sample backend verifies Firebase ID tokens. For a real production admin panel, add an `admin` custom claim to approved admin users and reject users without that claim inside `requireAdmin`.

## Firestore

The backend uses:
- `bookings` collection for public service requests.
- Job cards can be extended into a `jobCards` collection when you want technician/parts/labour/invoice workflow.

Do not expose Firebase Admin credentials in frontend code.

## Deploying the backend (Render)

1. Create a new **Web Service** from this GitHub repository.
2. Set **Root Directory** to `lorry-repair-pro/backend`, **Build Command** to `npm install`, and **Start Command** to `npm start`.
3. Add environment variables:
   - `FIREBASE_SERVICE_ACCOUNT`: the complete JSON from your Firebase Admin service-account key (keep it secret).
   - `FRONTEND_ORIGIN`: your Vercel website URL, for example `https://your-site.vercel.app`.
4. After Render gives you a public URL, place it in `frontend/config.js` as `API_BASE_URL`, then redeploy the frontend.

## Automatic customer notifications

When an admin changes a booking status (including through a job card), the backend can send an email and/or WhatsApp message automatically. Add either provider's credentials as Render environment variables:

- Email via Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- WhatsApp via Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`

Use `backend/.env.example` as the exact variable template. If a provider is not configured, the booking status still updates normally and the website status page still shows the latest result.
