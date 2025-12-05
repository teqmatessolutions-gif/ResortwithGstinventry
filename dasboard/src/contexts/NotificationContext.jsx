import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, CheckCircle, AlertCircle, Info, Package, ShoppingCart, Calendar, Wrench, DollarSign, UtensilsCrossed } from 'lucide-react';
import api from '../services/api';

const NotificationContext = createContext();

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

const getNotificationIcon = (type) => {
    const iconMap = {
        service: Wrench,
        booking: Calendar,
        package: Package,
        inventory: ShoppingCart,
        expense: DollarSign,
        food_order: UtensilsCrossed,
        success: CheckCircle,
        error: AlertCircle,
        info: Info,
    };
    return iconMap[type] || Info;
};

const getNotificationColor = (type) => {
    const colorMap = {
        service: 'bg-blue-500',
        booking: 'bg-purple-500',
        package: 'bg-indigo-500',
        inventory: 'bg-orange-500',
        expense: 'bg-red-500',
        food_order: 'bg-green-500',
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
    };
    return colorMap[type] || 'bg-gray-500';
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showPanel, setShowPanel] = useState(false);

    // Fetch notifications from backend
    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications?limit=50');
            setNotifications(response.data || []);
            const unread = (response.data || []).filter(n => !n.is_read).length;
            setUnreadCount(unread);
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    // Add a new notification (for real-time updates)
    const addNotification = (notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Auto-dismiss after 5 seconds for toast-style notifications
        if (notification.auto_dismiss !== false) {
            setTimeout(() => {
                removeNotification(notification.id);
            }, 5000);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        try {
            await api.put(`/notifications/${notificationId}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            await api.put('/notifications/mark-all-read');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    // Remove notification
    const removeNotification = (notificationId) => {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
    };

    // Delete notification
    const deleteNotification = async (notificationId) => {
        try {
            await api.delete(`/notifications/${notificationId}`);
            removeNotification(notificationId);
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    // Clear all notifications
    const clearAll = async () => {
        try {
            await api.delete('/notifications/clear-all');
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    };

    // Poll for new notifications every 30 seconds
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const value = {
        notifications,
        unreadCount,
        showPanel,
        setShowPanel,
        addNotification,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        fetchNotifications,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <NotificationPanel />
        </NotificationContext.Provider>
    );
};

// Notification Panel Component
const NotificationPanel = () => {
    const {
        notifications,
        unreadCount,
        showPanel,
        setShowPanel,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
    } = useNotifications();
    
    const navigate = useNavigate();

    if (!showPanel) return null;

    const handleNotificationClick = (notification) => {
        // Mark as read
        if (!notification.is_read) {
            markAsRead(notification.id);
        }
        
        // Close panel
        setShowPanel(false);

        // Determine navigation path
        const type = notification.entity_type || notification.type;
        // const id = notification.entity_id; // Can be used for detailed view if routes support it

        switch (type) {
            case 'booking':
                navigate('/bookings');
                break;
            case 'service':
            case 'service_request':
                navigate('/services');
                break;
            case 'food_order':
                navigate('/food-orders');
                break;
            case 'inventory':
            case 'stock_low':
                navigate('/inventory');
                break;
            case 'expense':
                navigate('/expenses');
                break;
            case 'package':
                navigate('/packages');
                break;
            case 'employee':
                navigate('/employee-management');
                break;
            default:
                // For generic info or unknown types, stay on current page or go to dashboard
                // navigate('/dashboard'); 
                break;
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-30 pointer-events-auto"
                onClick={() => setShowPanel(false)}
            />

            {/* Panel */}
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl pointer-events-auto transform transition-transform duration-300 ease-in-out">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Bell className="w-6 h-6" />
                        <div>
                            <h2 className="text-xl font-bold">Notifications</h2>
                            <p className="text-sm opacity-90">{unreadCount} unread</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPanel(false)}
                        className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Actions */}
                <div className="p-3 bg-gray-50 border-b flex gap-2">
                    <button
                        onClick={markAllAsRead}
                        className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        disabled={unreadCount === 0}
                    >
                        Mark all read
                    </button>
                    <button
                        onClick={clearAll}
                        className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-red-600"
                    >
                        Clear all
                    </button>
                </div>

                {/* Notifications List */}
                <div className="overflow-y-auto h-[calc(100vh-180px)]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Bell className="w-16 h-16 mb-4 opacity-50" />
                            <p className="text-lg font-medium">No notifications</p>
                            <p className="text-sm">You're all caught up!</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {notifications.map((notification) => (
                                <NotificationItem
                                    key={notification.id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                    onDelete={deleteNotification}
                                    onClick={() => handleNotificationClick(notification)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Individual Notification Item
const NotificationItem = ({ notification, onMarkAsRead, onDelete, onClick }) => {
    const Icon = getNotificationIcon(notification.type);
    const colorClass = getNotificationColor(notification.type);

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div
            onClick={onClick}
            className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.is_read ? 'bg-blue-50' : ''
                }`}
        >
            <div className="flex gap-3">
                {/* Icon */}
                <div className={`flex-shrink-0 w-10 h-10 ${colorClass} rounded-full flex items-center justify-center text-white`}>
                    <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-gray-900 text-sm">
                            {notification.title}
                        </h4>
                        {!notification.is_read && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                        )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs text-gray-400">
                            {formatTime(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onMarkAsRead(notification.id); }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Mark as read
                            </button>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(notification.id); }}
                            className="text-xs text-red-600 hover:text-red-800 font-medium z-10"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Notification Bell Button Component (to be used in header)
export const NotificationBell = () => {
    const { unreadCount, setShowPanel } = useNotifications();

    return (
        <button
            onClick={() => setShowPanel(true)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
            <Bell className="w-6 h-6 text-gray-700" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};
