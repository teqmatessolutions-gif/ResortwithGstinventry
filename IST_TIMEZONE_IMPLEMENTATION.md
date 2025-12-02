# IST Timezone Implementation Guide

## Overview
All dates and times in the application now use **India/Kerala (IST - UTC+5:30)** timezone.

## Frontend Usage

### Import the utilities
```javascript
import { 
  formatDateIST, 
  formatDateTimeIST, 
  formatTimeIST,
  getCurrentDateIST,
  getCurrentDateTimeIST,
  formatDateShort,
  formatDateLong,
  formatDateTimeShort,
  formatDateTimeLong,
  getRelativeTime
} from "../utils/dateUtils";
```

### Common Patterns

#### Replace `new Date().toISOString().split('T')[0]` with:
```javascript
getCurrentDateIST()  // Returns: "2025-11-28"
```

#### Replace `new Date(dateString).toLocaleDateString()` with:
```javascript
formatDateIST(dateString)  // Returns: "28 Nov 2025"
```

#### Replace `new Date(dateString).toLocaleString()` with:
```javascript
formatDateTimeIST(dateString)  // Returns: "28 Nov 2025, 02:30 PM"
```

#### Replace `new Date(dateString).toLocaleDateString('en-IN', {...})` with:
```javascript
formatDateIST(dateString, {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
})
```

## Backend Usage

### Import the utilities
```python
from app.utils.date_utils import (
    get_ist_now,
    get_ist_today,
    to_ist,
    format_datetime_ist,
    format_date_ist,
    format_time_ist,
    get_ist_date_range,
    utc_to_ist,
    ist_to_utc
)
```

### Common Patterns

#### Replace `datetime.utcnow` with:
```python
get_ist_now()  # Returns current datetime in IST
```

#### Replace `datetime.now()` with:
```python
get_ist_now()  # Returns current datetime in IST
```

#### Format datetime for display:
```python
format_datetime_ist(datetime_obj)  # Returns: "28 Nov 2025, 02:30 PM"
format_date_ist(datetime_obj)      # Returns: "28 Nov 2025"
format_time_ist(datetime_obj)      # Returns: "02:30 PM"
```

## Files Updated

### Frontend
- ✅ `dasboard/src/utils/dateUtils.js` - Created utility functions
- ✅ `dasboard/src/pages/Account.jsx` - Updated date displays
- ✅ `dasboard/src/pages/FoodOrders.jsx` - Updated date displays
- ✅ `dasboard/src/pages/EmployeeManagement.jsx` - Updated date displays
- ✅ `dasboard/src/pages/ComprehensiveReport.jsx` - Updated date displays

### Backend
- ✅ `ResortApp/app/utils/date_utils.py` - Created utility functions
- ✅ `ResortApp/app/models/expense.py` - Updated to use IST
- ✅ `ResortApp/requirements.txt` - Added pytz dependency

## Remaining Files to Update

The following files still need to be updated to use IST:

### Frontend Files
- `dasboard/src/pages/Inventory.jsx` - Multiple date displays
- `dasboard/src/pages/Bookings.jsx` - Check-in/check-out dates
- `dasboard/src/pages/Services.jsx` - Service assignment dates
- `dasboard/src/pages/Dashboard.jsx` - Dashboard date displays
- `dasboard/src/pages/UserHistory.jsx` - History dates

### Backend Files
- `ResortApp/app/models/checkout.py` - Checkout timestamps
- `ResortApp/app/models/service.py` - Service timestamps
- `ResortApp/app/models/foodorder.py` - Food order timestamps
- `ResortApp/app/models/inventory.py` - Inventory timestamps
- All other models with `datetime.utcnow` defaults

## Quick Migration Guide

### Frontend: Find and Replace
1. Find: `new Date().toISOString().split('T')[0]`
   Replace: `getCurrentDateIST()`

2. Find: `new Date(dateString).toLocaleDateString()`
   Replace: `formatDateIST(dateString)`

3. Find: `new Date(dateString).toLocaleString()`
   Replace: `formatDateTimeIST(dateString)`

### Backend: Find and Replace
1. Find: `default=datetime.utcnow`
   Replace: `default=get_ist_now` (after importing)

2. Find: `datetime.now()`
   Replace: `get_ist_now()` (for IST-aware timestamps)

## Testing

After updating files, test that:
1. All dates display in IST timezone
2. Date inputs use IST current date
3. Timestamps are stored correctly
4. Date comparisons work correctly

## Notes

- IST is UTC+5:30 (no daylight saving)
- All database timestamps should be stored in UTC, but displayed in IST
- Use `utc_to_ist()` and `ist_to_utc()` for conversions when needed
- Frontend automatically handles timezone conversion using `Intl.DateTimeFormat`








