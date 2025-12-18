const mongoose = require('mongoose');

const filterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['select', 'checkbox', 'range'],
    default: 'select'
  },
  category: {
    type: String,
    required: false,
    default: ''
  },
  options: [{
    value: String,
    label: String,
    icon: String
  }],
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Filter', filterSchema);
