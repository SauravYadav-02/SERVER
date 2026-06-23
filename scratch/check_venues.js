import mongoose from "mongoose";

async function checkVenues() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to DB");

    const VenueSchema = new mongoose.Schema({}, { strict: false });
    const Venue = mongoose.model("venues", VenueSchema);

    const venues = await Venue.find({}).limit(5);
    console.log(`Total venues found: ${venues.length}`);
    for (const v of venues) {
      console.log(`\n- Venue ID: ${v._id}`);
      console.log(`  Name: ${v.name}`);
      console.log(`  mediaFiles:`, v.mediaFiles);
      console.log(`  coverImage:`, v.coverImage);
    }

    mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

checkVenues();
