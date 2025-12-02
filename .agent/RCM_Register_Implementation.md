# RCM Register & Comprehensive Report Implementation Guide

## Overview
This document explains the Reverse Charge Mechanism (RCM) Register implementation and the complete GST Reports integration within the ResortApp's Comprehensive Report page.

---

## 1. What is the RCM Register?

### Definition
The **Reverse Charge Mechanism (RCM)** is a GST compliance mechanism where the **recipient of goods/services** (buyer) is liable to pay GST instead of the supplier. This is the "reverse" of the normal mechanism where the supplier collects and pays GST.

### When Does RCM Apply?

1. **Unregistered Vendors**: Purchases from vendors who don't have GST registration
2. **Specific Services**:
   - **GTA (Goods Transport Agency)** services
   - **Legal Services** from advocates
   - **Security Services**
   - **Import of Services** from foreign vendors
3. **Specific Goods**: As notified by the government (e.g., cashew nuts, bidi leaves)

### Key Characteristics

- **Tax Liability**: Buyer must pay GST to the government (not to supplier)
- **Payment Mode**: Must be paid in **cash** (cannot use ITC for payment)
- **ITC Claim**: Buyer can claim Input Tax Credit (ITC) in the **same month**
- **Self-Invoice**: Buyer must issue a self-invoice with number format like `SLF-YYYY-XXX`
- **Reporting**: Must be reported in GSTR-3B (Table 3.1.d)

### Example Scenario
```
Resort hires a lawyer (unregistered) for legal consultation
- Legal Fee: ₹10,000
- GST @ 18%: ₹1,800 (RCM liability)

Resort's Obligation:
1. Pay lawyer: ₹10,000 (no GST)
2. Pay government: ₹1,800 (in cash)
3. Claim ITC: ₹1,800 (in same month)
4. Net effect: ₹0 cash outflow for GST
```

---

## 2. RCM Register Structure

### Required Columns

| Column | Description | Example |
|--------|-------------|---------|
| **RCM Invoice No** | Self-invoice number | SLF-2024-001, EXP-123 |
| **RCM Date** | Date when liability arises | 2024-12-03 |
| **Supplier Name** | Vendor/service provider name | ABC Legal Services |
| **Supplier GSTIN** | Vendor's GST number (if any) | - (for unregistered) |
| **Nature of Supply** | Type of service/goods | Legal Services, GTA |
| **Original Bill No** | Vendor's bill/receipt number | INV-456 |
| **Taxable Value** | Base amount (excluding tax) | ₹10,000 |
| **Tax Rate** | GST rate applicable | 18% |
| **Tax Liability** | Tax amount to be paid | ₹1,800 |
| **IGST/CGST/SGST** | Tax breakdown | IGST: ₹1,800 or CGST: ₹900 + SGST: ₹900 |
| **ITC Eligibility** | Can ITC be claimed? | Eligible / Ineligible |
| **Place of Supply** | State where supply is made | Maharashtra |

### Summary Metrics

- **Total RCM Liability**: Total tax to be paid in cash
- **Total Taxable Value**: Sum of all base amounts
- **Total Records**: Count of RCM transactions
- **Tax Breakdown**: Total IGST, CGST, SGST

---

## 3. Backend Implementation

### Database Models

#### Expense Model (`app/models/expense.py`)
```python
class Expense(Base):
    # ... existing fields ...
    rcm_applicable = Column(Boolean, default=False)
    rcm_tax_rate = Column(Float, default=18.0)
    nature_of_supply = Column(String(100))  # GTA, Legal, Security, etc.
    self_invoice_number = Column(String(50))
    original_bill_no = Column(String(100))
    rcm_liability_date = Column(Date)
    itc_eligible = Column(Boolean, default=True)
```

#### Vendor Model (`app/models/inventory.py`)
```python
class Vendor(Base):
    # ... existing fields ...
    rcm_applicable = Column(Boolean, default=False)
    gst_number = Column(String(15))
    billing_state = Column(String(100))
```

### API Endpoint

**Endpoint**: `GET /api/gst-reports/rcm-register`

**Query Parameters**:
- `start_date` (optional): Filter from date (YYYY-MM-DD)
- `end_date` (optional): Filter to date (YYYY-MM-DD)

**Response Structure**:
```json
{
  "period": {
    "start_date": "2024-11-01",
    "end_date": "2024-11-30"
  },
  "summary": {
    "total_records": 15,
    "total_taxable_value": 150000.00,
    "total_tax_liability": 27000.00,
    "total_igst": 15000.00,
    "total_cgst": 6000.00,
    "total_sgst": 6000.00
  },
  "data": [
    {
      "rcm_invoice_no": "SLF-2024-001",
      "rcm_date": "2024-11-15",
      "supplier_name": "ABC Legal Services",
      "supplier_gstin": null,
      "nature_of_supply": "Legal Services",
      "original_bill_no": "INV-456",
      "taxable_value": 10000.00,
      "tax_rate": 18.0,
      "tax_liability": 1800.00,
      "igst": 1800.00,
      "cgst": 0.00,
      "sgst": 0.00,
      "itc_eligibility": "Eligible",
      "source_type": "Expense",
      "source_id": 123,
      "place_of_supply": "Maharashtra"
    }
  ]
}
```

### Logic Flow

1. **Query Expenses**: Filter expenses where `rcm_applicable = True`
2. **Query Purchases**: Filter purchases where vendor has `rcm_applicable = True`
3. **Calculate Tax**:
   - Determine inter-state vs intra-state (compare vendor state with resort state)
   - Inter-state: Apply IGST
   - Intra-state: Apply CGST + SGST (split 50-50)
4. **Aggregate Data**: Combine expenses and purchases
5. **Sort**: By RCM date (descending)
6. **Calculate Summary**: Sum all tax liabilities

---

## 4. Frontend Implementation

### Location
File: `dasboard/src/pages/ComprehensiveReport.jsx`

### Integration Points

#### 1. Report Definitions
```javascript
'gst': [
  { id: 'master-gst-summary', name: 'Master GST Summary', icon: BarChart3, endpoint: '/gst-reports/master-summary' },
  { id: 'gstr-1-sales', name: 'Sales (GSTR-1)', icon: TrendingUp, endpoint: '/gst-reports/b2b-sales' },
  { id: 'itc-register', name: 'Purchases (ITC Register)', icon: ShoppingCart, endpoint: '/gst-reports/itc-register' },
  { id: 'rcm-register', name: 'RCM Register', icon: Receipt, endpoint: '/gst-reports/rcm-register' },
  { id: 'gstr-2b-reconciliation', name: 'GSTR-2B Reconciliation', icon: FileCheck, endpoint: '/gst-reports/itc-register/reconcile-gstr2b' },
]
```

#### 2. Department Tab
```javascript
{ id: 'gst', name: 'GST Reports', icon: FileText, color: 'indigo' }
```

#### 3. RCM Register UI Components

**Summary Cards**:
- Total RCM Liability (orange)
- Total Taxable Value (blue)
- Total Records (green)
- Total IGST (purple)

**Information Note**:
Explains RCM mechanism and cash payment requirement

**Data Table**:
Displays all RCM transactions with:
- RCM Invoice No
- RCM Date
- Supplier Name
- Nature of Supply
- Taxable Value
- Tax Rate
- Tax Liability (highlighted in orange)
- ITC Eligibility (color-coded badge)
- Source (Expense/Purchase with ID)

### Date Range Filters

GST reports automatically include date range filters:
- **Start Date**: Filter from date
- **End Date**: Filter to date
- **Apply Filters** button to refresh data

---

## 5. Complete Comprehensive Report Structure

### Department Categories

1. **Front Office**
   - Daily Arrival Report
   - Daily Departure Report
   - Occupancy Report
   - Police / C-Form Report
   - Night Audit Report
   - No-Show & Cancellation
   - In-House Guest List

2. **Restaurant (F&B)**
   - Daily Sales Summary
   - Item-wise Sales Report
   - KOT Analysis
   - Void / Cancellation Report
   - Discount & Complimentary
   - NC (Non-Chargeable) Report

3. **Inventory & Purchase**
   - Stock Status Report
   - Low Stock Alert Report
   - Expiry / Aging Report
   - Stock Movement Register
   - Waste & Spoilage Report
   - Purchase Register
   - Variance Report

4. **Housekeeping & Facility**
   - Room Discrepancy Report
   - Laundry Cost Report
   - Minibar Consumption
   - Lost & Found Register
   - Maintenance Ticket Log
   - Asset Audit Report

5. **Security & HR**
   - Visitor Log
   - Staff Attendance
   - Payroll Register

6. **GST Reports** ⭐ NEW
   - Master GST Summary
   - Sales (GSTR-1)
   - Purchases (ITC Register)
   - RCM Register
   - GSTR-2B Reconciliation

---

## 6. GST Report Sections Explained

### 6.1 Master GST Summary

**Purpose**: High-level overview of GST position

**Components**:
- **Output Tax Liability**: Tax collected on sales
- **Input Tax Credit (ITC)**: Tax paid on purchases (claimable)
- **Net GST Payable**: Output Tax - ITC (amount to pay government)

**Use Case**: Monthly GST return filing (GSTR-3B)

### 6.2 Sales (GSTR-1)

**Purpose**: Outward supplies (sales) report

**Details**:
- B2B Sales (Business to Business)
- B2C Sales (Business to Consumer)
- HSN/SAC Summary
- Tax breakdown by rate

**Use Case**: GSTR-1 filing (monthly/quarterly)

### 6.3 Purchases (ITC Register)

**Purpose**: Track Input Tax Credit from purchases

**Categories**:
- **Input Goods**: Raw materials, consumables (eligible)
- **Capital Goods**: Fixed assets, equipment (eligible)
- **Input Services**: Services used for business (eligible)
- **Ineligible ITC**: Blocked credits (Section 17(5))

**Use Case**: Claim ITC in GSTR-3B

### 6.4 RCM Register

**Purpose**: Track Reverse Charge Mechanism liabilities

**Key Points**:
- Transactions where buyer pays GST
- Must be paid in cash
- ITC can be claimed in same month
- Reported in GSTR-3B (Table 3.1.d)

**Use Case**: RCM compliance and cash flow planning

### 6.5 GSTR-2B Reconciliation

**Purpose**: Match purchases with government's GSTR-2B data

**Process**:
1. Upload GSTR-2B Excel file from GST portal
2. System matches invoice numbers
3. Shows matched, unmatched, and missing invoices

**Use Case**: Ensure all ITC is claimed correctly

---

## 7. User Workflow

### Accessing RCM Register

1. Navigate to **Comprehensive Reports** page
2. Click on **GST Reports** tab (indigo color)
3. Select **RCM Register** from report list
4. Set date range filters (optional)
5. Click **Apply Filters**
6. View summary cards and detailed table

### Recording RCM Transactions

#### For Expenses:
1. Go to **Expenses** module
2. Create new expense
3. Check **RCM Applicable** checkbox
4. Select **Nature of Supply** (GTA, Legal, etc.)
5. Enter **RCM Tax Rate** (default 18%)
6. Enter **Original Bill No** from vendor
7. Set **ITC Eligibility**
8. Save expense

#### For Purchases:
1. Go to **Inventory** → **Vendors**
2. Edit vendor or create new
3. Check **RCM Applicable** checkbox
4. Save vendor
5. All purchases from this vendor will automatically be RCM transactions

---

## 8. Compliance & Best Practices

### Monthly Checklist

1. **Review RCM Register**: Check all RCM transactions for the month
2. **Verify Tax Calculation**: Ensure correct tax rates applied
3. **Check ITC Eligibility**: Confirm which transactions are eligible
4. **Calculate Cash Requirement**: Sum total RCM liability
5. **File GSTR-3B**: Report RCM in Table 3.1.d
6. **Claim ITC**: Claim eligible ITC in same month
7. **Pay Tax**: Pay RCM liability in cash

### Common Mistakes to Avoid

❌ **Don't**: Pay RCM tax to vendor
✅ **Do**: Pay vendor base amount only, pay tax to government

❌ **Don't**: Use ITC to pay RCM liability
✅ **Do**: Pay RCM in cash, claim ITC separately

❌ **Don't**: Delay ITC claim
✅ **Do**: Claim ITC in same month as RCM payment

❌ **Don't**: Forget to issue self-invoice
✅ **Do**: Generate self-invoice for all RCM transactions

### Documentation Required

- Vendor invoice/bill (original)
- Self-invoice (generated by resort)
- Payment proof (to vendor)
- GST payment challan (for RCM tax)
- ITC claim documentation

---

## 9. Technical Notes

### State Code Configuration

Resort state code is configured in `app/api/gst_reports.py`:
```python
RESORT_STATE_CODE = "27"  # Maharashtra
```

Update this based on your resort's location.

### Tax Calculation Logic

```python
# Inter-state (vendor from different state)
if vendor_state_code != RESORT_STATE_CODE:
    igst = taxable_value * (tax_rate / 100)
    cgst = 0
    sgst = 0

# Intra-state (vendor from same state)
else:
    igst = 0
    cgst = taxable_value * (tax_rate / 100) / 2
    sgst = taxable_value * (tax_rate / 100) / 2
```

### Data Sources

RCM Register pulls data from:
1. **Expense** table (where `rcm_applicable = True`)
2. **PurchaseMaster** + **Vendor** tables (where vendor has `rcm_applicable = True`)

---

## 10. Future Enhancements

### Planned Features

- [ ] Automated self-invoice generation
- [ ] RCM payment tracking
- [ ] ITC claim reconciliation
- [ ] Email alerts for RCM due dates
- [ ] Export to Excel/PDF
- [ ] Integration with GST portal API
- [ ] Automated GSTR-3B pre-fill

### Customization Options

- Add custom nature of supply types
- Configure default tax rates by service type
- Set up vendor-specific RCM rules
- Create automated workflows for RCM approval

---

## 11. Support & Troubleshooting

### Common Issues

**Issue**: RCM transactions not appearing
**Solution**: Check that `rcm_applicable` is set to `True` on expense or vendor

**Issue**: Wrong tax calculation
**Solution**: Verify vendor state code and resort state code match

**Issue**: ITC eligibility incorrect
**Solution**: Review category settings for inventory items

### Getting Help

- Check backend logs: `ResortApp/logs/`
- Review API response in browser DevTools
- Verify database records in expense/vendor tables
- Contact support with transaction details

---

## Conclusion

The RCM Register is now fully integrated into the Comprehensive Report page, providing:
- ✅ Complete RCM transaction tracking
- ✅ Accurate tax calculations (IGST/CGST/SGST)
- ✅ ITC eligibility tracking
- ✅ Summary metrics and detailed reporting
- ✅ Date range filtering
- ✅ Professional UI with color-coded indicators

This implementation ensures GST compliance and provides clear visibility into RCM liabilities for better cash flow management.
