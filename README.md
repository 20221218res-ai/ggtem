This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Admin Host Split

The app keeps admin routes under `/admin` during local development, but it is ready
to run the admin console on a separate host such as `topofword.com`.

```bash
ADMIN_HOSTS="admin.localhost:3000,topofword.com"
ADMIN_BASE_URL="https://topofword.com"
NEXT_PUBLIC_ADMIN_BASE_URL="https://topofword.com"
```

- `ADMIN_HOSTS`: comma-separated hosts treated as admin-only hosts.
- `ADMIN_BASE_URL`: when set, public-host `/admin` requests redirect to this host.
- `NEXT_PUBLIC_ADMIN_BASE_URL`: public client-side links can use this later when
  admin links need to be absolute.

Locally, `/admin` still works on `localhost:3000` if `ADMIN_BASE_URL` is not set.
On an admin host, `/` rewrites to `/admin`, and `/orders` rewrites to
`/admin/orders`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
