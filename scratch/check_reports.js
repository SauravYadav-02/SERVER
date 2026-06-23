import mongoose from "mongoose";

async function checkReports() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to DB");

    // Dynamic schema definitions for debug inspection
    const ReportSchema = new mongoose.Schema({}, { strict: false });
    const Report = mongoose.model("reports", ReportSchema);

    const reports = await Report.find({});
    console.log(`Total reports in database: ${reports.length}`);
    for (const r of reports) {
      console.log(`\n- ID: ${r._id}`);
      console.log(`  Title: ${r.title}`);
      console.log(`  Description: ${r.description}`);
      console.log(`  Status: ${r.status}`);
      console.log(`  Venue: ${r.venue}`);
      console.log(`  User: ${r.user}`);
      console.log(`  Attachments: ${r.attachments}`);
    }

    mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

checkReports();
