import { useState, useEffect, useRef, Fragment } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { AnimatePresence, motion, m } from "framer-motion";
import {
  Home,
  Users,
  BedDouble,
  CalendarCheck2,
  ConciergeBell,
  Settings,
  Menu,
  LogOut,
  Package,
  UserCircle,
  Utensils,
  ShieldCheck,
  PiggyBank,
  Grid,
  ChefHat,
  Receipt,
  Globe,
  Briefcase,
  Sun,
  Warehouse,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import orchidLogo from "../assets/orchidlogo.png";

import { CreditCard } from "lucide-react";

// Define professional, high-end themes with a focus on harmony and readability.
const themes = {
  'eco-friendly': {
    '--bg-primary': '#f0f7f4', // Soft mint green background
    '--bg-secondary': '#ffffff',
    '--text-primary': '#1a4d3a', // Deep forest green text
    '--text-secondary': '#5a7c6a', // Muted green-gray
    '--accent-bg': '#c8e6d5', // Light sage green accent (slightly more vibrant)
    '--accent-text': '#2d6a4f', // Medium green for active items
    '--bubble-color': 'rgba(76, 175, 80, 0.3)', // Soft green bubbles
    '--primary-button': '#22c55e', // Green for primary actions
    '--primary-button-hover': '#16a34a', // Darker green on hover
    '--border-color': '#a7d4b8', // Light green borders
  },
  'platinum': {
    '--bg-primary': '#f4f7f9',
    '--bg-secondary': '#ffffff',
    '--text-primary': '#2c3e50',
    '--text-secondary': '#7f8c8d',
    '--accent-bg': '#e7edf1', // A light, clean accent
    '--accent-text': '#34495e',
    '--bubble-color': 'rgba(175, 215, 255, 0.4)', // Soft blue bubbles
    '--primary-button': '#6366f1',
    '--primary-button-hover': '#4f46e5',
    '--border-color': '#e2e8f0',
  },
  'onyx': {
    '--bg-primary': '#1c1c1c',
    '--bg-secondary': '#2b2b2b',
    '--text-primary': '#ecf0f1',
    '--text-secondary': '#bdc3c7',
    '--accent-bg': '#34495e', // A deep blue-gray accent
    '--accent-text': '#f1c40f',
    '--bubble-color': 'rgba(255, 223, 186, 0.2)', // Faint gold bubbles
    '--primary-button': '#f1c40f',
    '--primary-button-hover': '#f39c12',
    '--border-color': '#34495e',
  },
  'gilded-age': {
    '--bg-primary': '#fdf8f0', // A warm, off-white
    '--bg-secondary': '#ffffff',
    '--text-primary': '#4a4a4a',
    '--text-secondary': '#8b7c6c',
    '--accent-bg': '#f5ecde',
    '--accent-text': '#4a4a4a',
    '--bubble-color': 'rgba(212, 172, 97, 0.3)',
    '--primary-button': '#d4ac61',
    '--primary-button-hover': '#b8945f',
    '--border-color': '#e8dcc6',
  },
  'orchid': {
    '--bg-primary': '#faf8f5', // Soft cream/ivory background
    '--bg-secondary': '#ffffff',
    '--text-primary': '#2d3748', // Deep charcoal
    '--text-secondary': '#718096', // Medium gray
    '--accent-bg': '#e8f5e9', // Light orchid green
    '--accent-text': '#2d5016', // Deep forest green
    '--bubble-color': 'rgba(139, 195, 74, 0.25)', // Soft orchid green bubbles
    '--primary-button': '#8bc34a', // Fresh orchid green
    '--primary-button-hover': '#7cb342', // Darker orchid green
    '--border-color': '#c5e1a5', // Light orchid green border
  },
};

// Helper function to apply the theme's CSS variables to the document root
const applyTheme = (themeName) => {
  const selectedTheme = themes[themeName];
  if (selectedTheme) {
    Object.keys(selectedTheme).forEach(key => {
      document.documentElement.style.setProperty(key, selectedTheme[key]);
    });
    // Set data attribute for theme-specific styling
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('dashboard-theme', themeName);
  }
};

const getUserPermissions = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    return { role: 'guest', permissions: [], user: null };
  }
  try {
    const decodedUser = jwtDecode(token);
    // Normalize role to lowercase for consistent comparison
    const normalizedRole = decodedUser?.role ? decodedUser.role.toLowerCase() : 'guest';
    return {
      role: normalizedRole,
      permissions: decodedUser?.permissions || [],
      user: decodedUser,
    };
  } catch (error) {
    console.error("Invalid token", error);
    return { role: 'guest', permissions: [], user: null };
  }
};

export const ProtectedRoute = ({ children, requiredPermission }) => {
  const { role, permissions } = getUserPermissions();

  // Admin has access to everything.
  // Otherwise, check if the user's permissions array includes the required permission.
  const hasAccess = role === 'admin' || permissions.includes(requiredPermission);

  if (!hasAccess) {
    // Redirect to dashboard with a message instead of showing blank page
    return <Navigate to="/dashboard" replace />;
  }

  // Ensure children are rendered properly
  if (!children) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const [currentTheme, setCurrentTheme] = useState('orchid'); // Default theme - orchid

  // State and ref for managing scroll position
  const navRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Load theme from localStorage on initial render
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme');
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Set orchid as default theme
      setCurrentTheme('orchid');
      applyTheme('orchid');
    }
  }, []);

  // Restore scroll position when the route changes
  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = scrollTop;
    }
  }, [location.pathname, scrollTop]);

  // Effect to create and manage the animated bubble background
  useEffect(() => {
    const bubbleContainer = document.getElementById('bubble-background');
    if (!bubbleContainer) return;
    bubbleContainer.innerHTML = ''; // Clear existing bubbles on theme change

    const createBubble = () => {
      const bubble = document.createElement('span');
      const size = Math.random() * 60 + 20; // Bubble size between 20px and 80px
      const animationDuration = Math.random() * 10 + 10; // Duration between 10s and 20s
      const delay = Math.random() * 5; // Start delay up to 5s
      const left = Math.random() * 100; // Horizontal start position

      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${left}%`;
      bubble.style.animationDuration = `${animationDuration}s`;
      bubble.style.animationDelay = `${delay}s`;
      bubble.style.backgroundColor = `var(--bubble-color)`; // Use theme color

      bubble.classList.add('bubble');
      bubbleContainer.appendChild(bubble);
    };

    for (let i = 0; i < 30; i++) { // Create 30 bubbles
      createBubble();
    }
  }, [currentTheme]);


  const { role, permissions, user } = getUserPermissions();
  // Menu items with role-based access control
  const allMenuItems = [
    { label: "Dashboard", icon: <Home size={18} />, to: "/dashboard" },
    { label: "Account", icon: <UserCircle size={18} />, to: "/account", roles: ["admin"] },
    { label: "Bookings", icon: <CalendarCheck2 size={18} />, to: "/bookings" },
    { label: "Services", icon: <ConciergeBell size={18} />, to: "/services" },
    { label: "Role", icon: <ShieldCheck size={18} />, to: "/roles", roles: ["admin"] },
    { label: "Expenses", icon: <PiggyBank size={18} />, to: "/expenses" },
    {
      label: "Food Management",
      icon: <Grid size={18} />,
      to: "/food-orders",
      roles: ["admin", "manager", "fnb"],
    },
    // {
    //   label: "Food Items",
    //   icon: <ChefHat size={18} />,
    //   to: "/food-items",
    //   roles: ["admin", "manager", "fnb"],
    // },
    {
      label: "Billing",
      icon: <Receipt size={18} />,
      to: "/billing",
      roles: ["admin", "manager", "fnb"],
    },
    {
      label: "WEB Management",
      icon: <Globe size={18} />,
      to: "/Userfrontend_data",
      roles: ["admin", "manager", "fnb"],
    },
    { label: "Reports", icon: <Sun size={18} />, to: "/report", roles: ["admin", "manager", "fnb"] },
    { label: "GuestProfiles", icon: <Sun size={18} />, to: "/guestprofiles", roles: ["admin", "manager", "fnb"] },
    { label: "User History", icon: <Users size={18} />, to: "/user-history", roles: ["admin", "manager"] },
    { label: "Employee Mgt", icon: <Briefcase size={18} />, to: "/employee-management", roles: ["admin", "manager"] },
    { label: "Inventory", icon: <Warehouse size={18} />, to: "/inventory", roles: ["admin", "manager"] },
    { label: "Settings", icon: <Settings size={18} />, to: "/settings", roles: ["admin"] },
  ];

  const menuItems = allMenuItems.filter((item) => {
    // Admin role has access to everything, regardless of permissions.
    if (role === 'admin') {
      return true;
    }
    // For other roles, check if their permissions list includes the item's route.
    return permissions.includes(item.to);
  });

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors duration-300 font-sans"
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}
    >
      {/* Mobile overlay for sidebar */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Bubble animation styles */}
      <style>
        {`
        @keyframes moveBubbles {
          0% { transform: translateY(0) rotate(0deg); opacity: 0; border-radius: 0; }
          50% { opacity: 1; border-radius: 50%; }
          100% { transform: translateY(-100vh) rotate(720deg); opacity: 0; }
        }

        .bubble {
          position: absolute;
          bottom: -150px;
          animation: moveBubbles infinite ease-in;
          filter: blur(2px);
          border-radius: 50%;
        }

        @media (max-width: 1024px) {
          .bubble {
            display: none; /* Hide bubbles on mobile for better performance */
          }
        }
        `}
      </style>

      {/* Bubble container */}
      <div id="bubble-background" className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0"></div>

      <div className="flex h-full w-full relative z-10">

        {/* Sidebar container */}
        <div
          className={`shadow-xl transition-all duration-300 ${collapsed ? "w-16 lg:w-20" : "w-72"
            } flex flex-col flex-shrink-0 z-50 rounded-r-2xl overflow-hidden fixed lg:relative h-full ${collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
            }`}
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {/* Header section with logo, app name, and menu toggle */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--accent-bg)' }}>
            {/* Left side: App Logo */}
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-xl flex items-center justify-center shadow-lg border-2 bg-gradient-to-br from-gray-800 via-gray-900 to-black" style={{ borderColor: 'var(--accent-bg)' }}>
                <img src={orchidLogo} className="h-20 w-auto object-contain drop-shadow-md" alt="Orchid Resort Logo" />
              </div>
            </div>
            {/* Right side: Menu Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-full transition-colors duration-200"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Theme Switcher UI with image previews */}
          <div className={`p-4 transition-all duration-300 flex justify-center gap-2 border-b`} style={{ borderColor: 'var(--accent-bg)' }}>
            <motion.button
              animate={{ scale: currentTheme === 'orchid' ? 1.15 : 1, y: currentTheme === 'orchid' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'orchid' ? 'shadow-lg border-2 border-[#8bc34a]' : ''}`}
              onClick={() => { setCurrentTheme('orchid'); applyTheme('orchid'); }}
              title="Orchid"
            >
              <img src={orchidLogo} alt="Orchid Theme" className="w-full h-full object-cover" />
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'eco-friendly' ? 1.15 : 1, y: currentTheme === 'eco-friendly' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'eco-friendly' ? 'shadow-lg border-2 border-green-500' : ''}`}
              onClick={() => { setCurrentTheme('eco-friendly'); applyTheme('eco-friendly'); }}
              title="Eco-Friendly"
            >
              <div className="w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">🌿</div>
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'platinum' ? 1.15 : 1, y: currentTheme === 'platinum' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'platinum' ? 'shadow-lg border-2 border-gray-400' : ''}`}
              onClick={() => { setCurrentTheme('platinum'); applyTheme('platinum'); }}
              title="Platinum"
            >
              <img src="https://placehold.co/32x32/f4f7f9/2c3e50?text=P" alt="Platinum Theme" className="w-full h-full object-cover" />
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'onyx' ? 1.15 : 1, y: currentTheme === 'onyx' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'onyx' ? 'shadow-lg border-2 border-yellow-600' : ''}`}
              onClick={() => { setCurrentTheme('onyx'); applyTheme('onyx'); }}
              title="Onyx"
            >
              <img src="https://placehold.co/32x32/1c1c1c/f1c40f?text=O" alt="Onyx Theme" className="w-full h-full object-cover" />
            </motion.button>
            <motion.button
              animate={{ scale: currentTheme === 'gilded-age' ? 1.15 : 1, y: currentTheme === 'gilded-age' ? -2 : 0 }}
              whileHover={{ scale: 1.2, y: -2 }} whileTap={{ scale: 1.1 }} transition={{ type: 'spring', stiffness: 300 }}
              className={`w-8 h-8 rounded-full overflow-hidden ${currentTheme === 'gilded-age' ? 'shadow-lg border-2 border-yellow-800' : ''}`}
              onClick={() => { setCurrentTheme('gilded-age'); applyTheme('gilded-age'); }}
              title="Gilded Age"
            >
              <img src="https://placehold.co/32x32/fdf8f0/d4ac61?text=G" alt="Gilded Age Theme" className="w-full h-full object-cover" />
            </motion.button>
          </div>

          {/* Main navigation menu */}
          <nav
            ref={navRef}
            className="flex-1 p-4 space-y-2 z-30 overflow-y-auto"
            onScroll={() => {
              if (navRef.current) {
                setScrollTop(navRef.current.scrollTop);
              }
            }}
          >
            {menuItems.map((item, idx) => {
              // Improved active state detection - check exact match or if path starts with the route
              const exactMatch = location.pathname === item.to;
              const startsWithMatch = item.to !== '/dashboard' && location.pathname.startsWith(item.to);
              const isActive = exactMatch || startsWithMatch;

              return (
                <Link
                  key={idx}
                  to={item.to}
                  className={`
                    group block flex items-center gap-4 p-3 rounded-xl
                    transition-all duration-200 cursor-pointer
                    ${isActive ? "font-semibold" : ""}
                  `}
                  style={{
                    backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent',
                    color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
                  }}
                >
                  <motion.span whileHover={{ scale: isActive ? 1 : 1.1, rotate: isActive ? 0 : -5 }} className="transition-transform duration-200">
                    {item.icon}
                  </motion.span>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="transition-opacity duration-200">{item.label}</motion.span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Logout section at the bottom */}
          <div className="p-4 border-t" style={{ borderColor: 'var(--accent-bg)' }}>
            <Link
              to="/"
              className="group block flex items-center gap-4 p-3 rounded-xl transition-all duration-200 cursor-pointer hover:opacity-75"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="group-hover:scale-110 transition-transform duration-200">
                <LogOut size={18} />
              </span>
              {!collapsed && <span className="transition-opacity duration-200">Log Out</span>}
            </Link>
          </div>

          {/* User Info section */}
          <div className="p-6 border-t z-20" style={{ borderColor: 'var(--accent-bg)' }}>
            {!collapsed && (
              <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                {user ? `Logged in as: ${user.name || user.email || role}` : "Not logged in"}
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6 lg:p-8 z-10 lg:ml-0 ml-0" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}