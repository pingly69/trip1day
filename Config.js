/**
 * Config.js — Central Configuration & Constants
 * Mileage Reimbursement System (v10.1)
 */

const CONFIG = {
  SPREADSHEET_ID: '1CNTlNGn7w5rRDWundhnNgFaUII9kQvAEBUmWe0lpWGw',
  LIFF_ID: '2009018471-MgapzP63', // Replace with actual LIFF ID when deployed
  TIMEZONE: 'Asia/Bangkok',
  RETENTION_DAYS: 10,
  MAINTENANCE_EMAIL_RECIPIENTS: 'pingly69@gmail.com,pingly69@outlook.com',
  FLAT_RATE_FEE: 150,
  MIN_TRIPS_PER_DAY: 1,
  MAX_TRIPS_PER_DAY: 10,
  CACHE_TTL_SECONDS: 600, // 10 minutes
  LOCK_TIMEOUT_MS: 15000,  // 15 seconds

  SHEETS: {
    USERS_PROFILE: 'users_profile',
    MASTER_SITE: 'Master_Site',
    APPROVE_USERS: 'Approve_users',
    MASTER_ROUTES: 'Master_Routes',
    MASTER_CONFIG: 'Master_Config',
    RATE_CAR: 'Rate_Car',
    TRANSACTIONS: 'Transactions'
  },

  HEADERS: {
    USERS_PROFILE: ['Line_uid', 'requester_name', 'car_no', 'group_car'],
    MASTER_SITE: ['Site_ID', 'Site_Name', 'Active'],
    APPROVE_USERS: ['approve_request', 'line_profile', 'line_uid', 'Active'],
    MASTER_ROUTES: ['Route_ID', 'Site_ID', 'Route_Name', 'Origin', 'Destination', 'Distance_KM', 'Active'],
    MASTER_CONFIG: ['Key', 'Value'],
    RATE_CAR: ['dt_date', 'group_car1', 'group_car2'],
    TRANSACTIONS: [
      'Transaction_ID',
      'Req_Name',
      'Req_LINE_UserId',
      'Req_Date',
      'Plate_No',
      'Site_ID',
      'Site_Name',
      'Travel_Purpose',
      'Image_URL',
      'Total_KM',
      'Toll_Fee',
      'Park_Fee',
      'Flat_Rate_Fee',
      'Net_Total',
      'Approver',
      'Status',
      'Approve_Datetime',
      'Trip_Details',
      'Created_At',
      'Updated_At'
    ]
  }
};

/**
 * Initializes missing sheets and sets up default headers & initial data if empty.
 */
function initDatabase() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // 1. users_profile
  ensureSheetWithHeaders(ss, CONFIG.SHEETS.USERS_PROFILE, CONFIG.HEADERS.USERS_PROFILE);

  // 2. Master_Site
  const siteSheet = ensureSheetWithHeaders(ss, CONFIG.SHEETS.MASTER_SITE, CONFIG.HEADERS.MASTER_SITE);
  if (siteSheet.getLastRow() <= 1) {
    siteSheet.appendRow(['SITE-001', 'คลังขอนแก่น', true]);
    siteSheet.appendRow(['SITE-002', 'โครงการ ABC สาขาอุดร', true]);
  }

  // 3. Approve_users
  const approveSheet = ensureSheetWithHeaders(ss, CONFIG.SHEETS.APPROVE_USERS, CONFIG.HEADERS.APPROVE_USERS);
  if (approveSheet.getLastRow() <= 1) {
    approveSheet.appendRow(['ผู้จัดการแผนก (Manager)', 'EMP-001', '', true]);
    approveSheet.appendRow(['ผู้อำนวยการ (Director)', 'EMP-002', '', true]);
  }

  // 4. Master_Routes
  const routeSheet = ensureSheetWithHeaders(ss, CONFIG.SHEETS.MASTER_ROUTES, CONFIG.HEADERS.MASTER_ROUTES);
  if (routeSheet.getLastRow() <= 1) {
    routeSheet.appendRow(['RT-001', 'SITE-001', 'คลังขอนแก่น -> สาขาอุดร', 'คลังขอนแก่น', 'สาขาอุดร', 50, true]);
    routeSheet.appendRow(['RT-002', 'SITE-001', 'คลังขอนแก่น -> ศูนย์กระจายสินค้า', 'คลังขอนแก่น', 'ศูนย์กระจายสินค้า', 35, true]);
    routeSheet.appendRow(['RT-003', 'SITE-002', 'สาขาอุดร -> คลังอุดร', 'สาขาอุดร', 'คลังอุดร', 15, true]);
  }

  // 5. Master_Config
  const configSheet = ensureSheetWithHeaders(ss, CONFIG.SHEETS.MASTER_CONFIG, CONFIG.HEADERS.MASTER_CONFIG);
  if (configSheet.getLastRow() <= 1) {
    configSheet.appendRow(['FLAT_RATE_FEE', 150]);
    configSheet.appendRow(['MAX_TRIPS_PER_DAY', 10]);
    configSheet.appendRow(['MIN_TRIPS_PER_DAY', 1]);
  }

  // 6. Rate_Car
  const rateSheet = ensureSheetWithHeaders(ss, CONFIG.SHEETS.RATE_CAR, CONFIG.HEADERS.RATE_CAR);
  if (rateSheet.getLastRow() <= 1) {
    rateSheet.appendRow(['2026-01-01', 4.0, 4.0]);
    rateSheet.appendRow(['2026-04-17', 5.0, 5.0]);
    rateSheet.appendRow(['2026-06-26', 4.8, 4.8]);
  }

  // 7. Transactions
  ensureSheetWithHeaders(ss, CONFIG.SHEETS.TRANSACTIONS, CONFIG.HEADERS.TRANSACTIONS);

  Logger.log('Database initialization completed successfully.');
  return { success: true, message: 'Database initialized successfully.' };
}

/**
 * Helper to ensure a sheet exists and has headers.
 */
function ensureSheetWithHeaders(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}
