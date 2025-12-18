const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: false,
    default: ''
  },
  image: {
    type: String,
    default: 'https://via.placeholder.com/300'
  },
  images: {
    type: [String],
    default: []
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  specifications: {
    type: Map,
    of: String
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    user: String,
    comment: String,
    rating: Number,
    date: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Index cho tìm kiếm
productSchema.index({ name: 'text', description: 'text', brand: 'text' });

module.exports = mongoose.model('Product', productSchema);
