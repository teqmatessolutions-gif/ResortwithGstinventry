# Outstanding Issues & Feature Requests

## Status: GST Reports Implementation ✅ COMPLETE

### What's Working:
✅ **Master GST Summary** - Displays output tax, ITC, and net payable
✅ **Sales (GSTR-1)** - B2B/B2C sales reporting  
✅ **Purchases (ITC Register)** - Input tax credit tracking
✅ **RCM Register** - Reverse charge mechanism tracking with summary cards

### Note on GSTR-2B Reconciliation:
- This feature requires **file upload** (POST method with multipart/form-data)
- Already fully implemented in `Account.jsx` → GST Reports tab
- Not included in Comprehensive Reports auto-fetch to avoid 405 errors
- Users can access it from the Account page for file upload functionality

---

## New Feature Requests

### 1. Menu Navigation Without Page Refresh 🔄

**Issue**: Currently, clicking menu items causes full page refresh

**Current Behavior**:
- Menu items trigger page reload
- Entire application state resets
- Poor user experience

**Desired Behavior**:
- Menu items should use React Router navigation
- Only the content area should update
- Application state should persist
- Faster navigation

**Implementation Required**:
- Review `DashboardLayout.jsx` or main navigation component
- Replace `<a href>` tags with `<Link to>` from react-router-dom
- Ensure all menu items use client-side routing
- Remove any `window.location.href` assignments

**Files to Check**:
- `dasboard/src/layout/DashboardLayout.jsx`
- `dasboard/src/components/Sidebar.jsx` (if exists)
- `dasboard/src/components/Navigation.jsx` (if exists)

**Example Fix**:
```jsx
// ❌ Current (causes refresh)
<a href="/bookings">Bookings</a>

// ✅ Correct (no refresh)
import { Link } from 'react-router-dom';
<Link to="/bookings">Bookings</Link>
```

---

### 2. Compulsory Booking Notification After Check-in 🔔

**Issue**: Need automatic notification with booking ID after guest check-in

**Requirements**:
1. **Trigger**: Automatically send notification when booking status changes to "checked-in"
2. **Content**: Must include booking ID
3. **Recipients**: TBD (staff, management, specific roles?)
4. **Notification Type**: In-app notification, email, SMS, or all?

**Implementation Steps**:

#### Backend Changes:

**File**: `ResortApp/app/api/bookings.py`

1. **Modify Check-in Endpoint**:
```python
@router.put("/{booking_id}/checkin")
async def checkin_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # ... existing check-in logic ...
    
    # After successful check-in, create notification
    notification = Notification(
        user_id=current_user.id,  # or specific user/role
        title=f"Guest Checked In - Booking #{booking_id}",
        message=f"Guest {booking.guest_name} has checked in. Booking ID: {booking_id}, Room: {booking.room.room_number}",
        type="check_in",
        reference_id=booking_id,
        reference_type="booking",
        created_at=datetime.utcnow()
    )
    db.add(notification)
    db.commit()
    
    return {"message": "Check-in successful", "booking_id": booking_id}
```

2. **Notification Model** (check if exists in `app/models/notification.py`):
```python
class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(200))
    message = Column(Text)
    type = Column(String(50))  # check_in, check_out, booking, payment, etc.
    reference_id = Column(Integer)  # booking_id, payment_id, etc.
    reference_type = Column(String(50))  # booking, payment, etc.
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="notifications")
```

#### Frontend Changes:

**File**: `dasboard/src/pages/Bookings.jsx` or wherever check-in is triggered

1. **Show Success Notification**:
```jsx
const handleCheckIn = async (bookingId) => {
  try {
    const response = await API.put(`/bookings/${bookingId}/checkin`);
    
    // Show success notification
    alert(`✅ Check-in successful! Booking ID: ${response.data.booking_id}`);
    
    // Or use a toast notification library
    toast.success(`Guest checked in successfully! Booking #${response.data.booking_id}`);
    
    // Refresh bookings list
    fetchBookings();
  } catch (error) {
    console.error('Check-in failed:', error);
    alert('❌ Check-in failed. Please try again.');
  }
};
```

2. **Add Notification Bell** (if not exists):
```jsx
// In DashboardLayout or Header component
import { Bell } from 'lucide-react';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    const response = await API.get('/notifications?limit=50');
    setNotifications(response.data);
    setUnreadCount(response.data.filter(n => !n.is_read).length);
  };

  return (
    <div className="relative">
      <button className="relative p-2">
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      {/* Notification dropdown */}
    </div>
  );
};
```

**Questions to Clarify**:
1. Should notifications be sent to specific users/roles or all staff?
2. Do you want email/SMS notifications in addition to in-app?
3. Should there be different notification types for check-in vs check-out?
4. What other events should trigger notifications?

---

## Priority Order

1. **HIGH**: Menu navigation without refresh (improves UX significantly)
2. **MEDIUM**: Booking check-in notifications (business requirement)
3. **LOW**: Additional notification types and channels

---

## Next Steps

Please confirm:
1. ✅ GST Reports implementation is satisfactory?
2. 🔄 Should I proceed with fixing menu navigation?
3. 🔔 Notification requirements clarification:
   - Who should receive check-in notifications?
   - In-app only or also email/SMS?
   - Any other events that need notifications?

---

## Files Modified in This Session

### GST Reports Implementation:
- ✅ `dasboard/src/pages/Account.jsx` - Enhanced RCM Register display
- ✅ `dasboard/src/pages/ComprehensiveReport.jsx` - Added GST Reports category
- ✅ `.agent/RCM_Register_Implementation.md` - Comprehensive documentation

### Backend (Already Implemented):
- ✅ `ResortApp/app/api/gst_reports.py` - All GST report endpoints
- ✅ `ResortApp/app/models/expense.py` - RCM fields
- ✅ `ResortApp/app/models/inventory.py` - Vendor RCM fields

---

## Current System Status

✅ **Frontend**: Running on http://localhost:3000
✅ **Backend**: Running on http://localhost:8011
✅ **GST Reports**: Fully functional
✅ **RCM Register**: Displaying correctly with summary cards
✅ **Compilation**: No errors

**Console Warnings** (Non-critical):
- React Router future flags (v7 migration warnings)
- React DevTools recommendation (development only)

All systems operational! 🚀
