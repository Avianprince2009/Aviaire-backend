import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    collection: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    orderId: { type: String, required: true, unique: true, index: true },

    paymentReference: { type: String, index: true, default: "" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },

    // Amount stored in kobo
    amount: { type: Number, required: true, min: 0 },

    currency: { type: String, default: "NGN" },

    orderStatusSystem: {
      // internal string for admins (display-ready)
      type: String,
      default: "pending",
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      index: true,
    },

    orderStatus: {
      // display label, kept in sync with orderStatusSystem
      type: String,
      default: "Pending",
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      index: true,
    },

    shipping: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true },
      phone: { type: String, default: "", trim: true },
      address1: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
    },

    orderDetails: {
      items: { type: [OrderItemSchema], default: [] },
      total: { type: Number, required: true, min: 0 },
      placedAt: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
  }
);

// Orders admin list is filtered by orderStatusSystem and optionally searched via shipping fields,
// and sorted by createdAt / orderDetails.total / orderDetails.placedAt.
// Composite indexes significantly reduce collection scans + in-memory sorts.
OrderSchema.index({ orderStatusSystem: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ "orderDetails.total": -1, createdAt: -1 });
OrderSchema.index({ "orderDetails.placedAt": -1, createdAt: -1 });

export default mongoose.model("Order", OrderSchema);





