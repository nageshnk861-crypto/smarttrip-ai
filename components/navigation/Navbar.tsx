'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Compass, 
  MapPin, 
  Calendar, 
  LayoutDashboard, 
  Info, 
  User, 
  Bookmark, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  ChevronDown,
  Settings
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string; id?: string; name?: string } | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      if (!isSupabaseConfigured || !supabase) {
        if (mounted) setIsLoadingAuth(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            });
          } else {
            setUser(null);
          }
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    }

    checkAuth();

    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
          });
        } else {
          setUser(null);
        }
      });

      return () => {
        mounted = false;
        authListener?.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
      setUser(null);
      router.push('/');
      router.refresh();
    }
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  };

  const navLinks = [
    { label: 'Explore', href: '/explore', icon: MapPin },
    { label: 'Trip Planner', href: '/planner', icon: Compass },
    { label: 'My Trips', href: '/trips', icon: Calendar },
    { label: 'About', href: '/about', icon: Info },
  ];

  return (
    <header className="site-header">
      {/* Top micro-banner for demo/provider status */}
      <div className="status-banner">
        <div className="container status-banner-content">
          <span className="status-pill">
            <span className="status-dot"></span>
            {isSupabaseConfigured ? 'Supabase Connected' : 'Local / Demo Mode — connect providers for live sync'}
          </span>
          <span className="status-notice">Budget-Aware AI Travel Planning</span>
        </div>
      </div>

      <nav className="navbar">
        {/* Brand Logo */}
        <Link href="/" className="brand-logo" aria-label="SmartTrip AI Home">
          <div className="brand-icon">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="brand-text">
            SmartTrip<span className="brand-highlight">AI</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="desktop-nav-links">
          {navLinks.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                onClick={closeMenus}
              >
                <Icon className="nav-icon" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Right actions: Auth or User Menu */}
        <div className="nav-actions">
          {!isLoadingAuth && user ? (
            <div className="user-dropdown-container" ref={userMenuRef}>
              <button
                type="button"
                className="user-menu-button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="user-avatar">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="user-name-display">{user.name || 'Account'}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>

              {userMenuOpen && (
                <div className="user-dropdown-menu">
                  <div className="dropdown-header">
                    <div className="font-semibold text-slate-800">{user.name}</div>
                    <div className="text-xs text-slate-500 truncate">{user.email}</div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link href="/trips" className="dropdown-item" onClick={closeMenus}>
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span>My Trips</span>
                  </Link>
                  <Link href="/saved" className="dropdown-item" onClick={closeMenus}>
                    <Bookmark className="w-4 h-4 text-slate-500" />
                    <span>Saved Places</span>
                  </Link>
                  <Link href="/profile" className="dropdown-item" onClick={closeMenus}>
                    <User className="w-4 h-4 text-slate-500" />
                    <span>Profile & Preferences</span>
                  </Link>
                  <Link href="/profile#settings" className="dropdown-item" onClick={closeMenus}>
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Settings</span>
                  </Link>
                  <div className="dropdown-divider"></div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="dropdown-item dropdown-item-danger"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="guest-actions">
              <Link href="/login" className="login-link">
                Sign In
              </Link>
              <Link href="/planner" className="btn-primary-nav">
                <Compass className="w-4 h-4" />
                <span>Plan My Trip</span>
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-hamburger"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="brand-logo">
                <div className="brand-icon">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="brand-text">
                  SmartTrip<span className="brand-highlight">AI</span>
                </span>
              </div>
              <button
                type="button"
                className="close-drawer-button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mobile-links-list">
              {navLinks.map(({ label, href, icon: Icon }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`mobile-nav-item ${isActive ? 'mobile-nav-item-active' : ''}`}
                  >
                    <Icon className="w-5 h-5 text-slate-500" />
                    <span>{label}</span>
                  </Link>
                );
              })}

              {user && (
                <>
                  <div className="mobile-section-divider">Account</div>
                  <Link href="/saved" className="mobile-nav-item">
                    <Bookmark className="w-5 h-5 text-slate-500" />
                    <span>Saved Places</span>
                  </Link>
                  <Link href="/profile" className="mobile-nav-item">
                    <User className="w-5 h-5 text-slate-500" />
                    <span>Profile & Settings</span>
                  </Link>
                </>
              )}
            </div>

            <div className="mobile-drawer-footer">
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mobile-signout-btn"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out ({user.email})</span>
                </button>
              ) : (
                <div className="mobile-auth-actions">
                  <Link href="/login" className="mobile-login-btn">
                    Sign In
                  </Link>
                  <Link href="/register" className="mobile-register-btn">
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
