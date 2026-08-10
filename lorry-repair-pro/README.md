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
