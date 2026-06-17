const BASE_URL = "http://localhost:3000";
const ADMIN_ID = "admin-mock-id";

const endpoints = [
  { name: "Admin Venues", url: `${BASE_URL}/admin/venues`, method: "GET" },
  { name: "Admin Reviews", url: `${BASE_URL}/admin/reviews`, method: "GET" },
  { name: "Admin Bookings", url: `${BASE_URL}/bookings/`, method: "GET" },
  { name: "Admin Complaints", url: `${BASE_URL}/complaints/`, method: "GET" },
  { name: "Admin Reports", url: `${BASE_URL}/reports/`, method: "GET" },
  { name: "Admin Plans", url: `${BASE_URL}/api/admin/plans`, method: "GET" },
  { name: "Plans All", url: `${BASE_URL}/plans/all`, method: "GET" },
  { name: "All Subscriptions", url: `${BASE_URL}/subscription/all`, method: "GET" },
  { name: "Expiring Subscriptions", url: `${BASE_URL}/subscription/expiring-soon`, method: "GET" },
  { name: "All Payments", url: `${BASE_URL}/payments/`, method: "GET" },
  { name: "Admin-Vendor Payments", url: `${BASE_URL}/payments/admin-vendor`, method: "GET" },
  { name: "User-Vendor Payments", url: `${BASE_URL}/payments/user-vendor`, method: "GET" },
  { name: "All Users", url: `${BASE_URL}/users/`, method: "GET" },
  { name: "All Vendors", url: `${BASE_URL}/vendors/`, method: "GET" },
];

async function runTests() {
  console.log("Starting full Admin API request tests including plans/all...\n");

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { adminid: ADMIN_ID },
      });
      
      if (res.ok) {
        console.log(`[OK]  ${ep.name}: Status ${res.status}`);
      } else {
        const bodyText = await res.text();
        console.error(`[ERR] ${ep.name}: Status ${res.status}`);
        console.error(`      Response:`, bodyText);
      }
    } catch (err) {
      console.error(`[ERR] ${ep.name}: Network/Request Error: ${err.message}`);
    }
  }
}

runTests();
