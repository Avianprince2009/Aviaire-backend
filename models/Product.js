import mongoose from 'mongoose'

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    collection: { type: String, required: true },
    price: { type: Number, required: true },
    imageUrl: { type: String },
    description: { type: String },
  },
  { timestamps: true, collection: 'products' }
)

export default mongoose.models.Product || mongoose.model('Product', productSchema)
