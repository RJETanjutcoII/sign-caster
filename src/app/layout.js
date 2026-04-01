import "./globals.css";

export const metadata = {
  title: 'Sign Caster',
  description: 'Cast abilities with hand gestures',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
