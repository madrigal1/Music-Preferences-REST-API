const mongoose = require("mongoose");

const featureSchema = new mongoose.Schema({
    userId: String,
    data: [[Number]],
});

module.exports = mongoose.model("feature", featureSchema);