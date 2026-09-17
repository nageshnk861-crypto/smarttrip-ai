import './globals.css';

export const metadata = {
  title: 'SmartTrip AI',
  description: 'Plan smarter trips with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <nav className="navbar">
            <a href="/" className="logo">
              SmartTrip AI
            </a>

            <div className="nav-links">
              <a href="/">Home</a>
              <a href="/dashboard">Dashboard</a>
              <a href="/planner">Trip Planner</a>
              <a href="/login">Login</a>
            </div>
          </nav>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <p>© {new Date().getFullYear()} SmartTrip AI. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}