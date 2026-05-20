const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    collection: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);


module.exports = mongoose.model("Product", ProductSchema);


