export const metadata = {
  title: "Brand Audit Tool",
  description: "Off-site brand reputation, visibility & competitive analysis",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
