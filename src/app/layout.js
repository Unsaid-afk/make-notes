import './globals.css';

export const metadata = {
  title: 'Class Notes - Untitled Document',
  description: 'Google Docs - create and edit documents online, for free.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Hydration fix applied */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
