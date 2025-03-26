const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'Unknown'
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  gstin: {
    type: String,
    default: ''
  },
  called: {
    type: Boolean,
    default: false
  },
  callDate: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema); 