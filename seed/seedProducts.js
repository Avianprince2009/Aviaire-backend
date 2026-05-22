import ProductModel from '../models/product.model.js';

const SEED_PRODUCTS = [
  {
    name: 'Rolex Submariner',
    description: "A timeless diver's icon with enduring character.",
    price: 12500,
    collection: 'rolex',
    imageUrl:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Omega Seamaster',
    description: 'Sport-ready precision built for everyday resilience.',
    price: 980,
    collection: 'omega',
    imageUrl:
      'https://images.unsplash.com/photo-1502741338009-cac2772e18bc?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Patek Philippe Calatrava',
    description: 'A discreet statement crafted for collectors.',
    price: 3200,
    collection: 'patek-philippe',
    imageUrl:
      'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=800&q=80',
  },
];

async function seedProductsIfEmpty() {
  const count = await ProductModel.countDocuments({});
  if (count > 0) return { seeded: false, count };

  const created = await ProductModel.insertMany(SEED_PRODUCTS);
  return { seeded: true, createdCount: created.length, count: created.length };
}

export { seedProductsIfEmpty, SEED_PRODUCTS };