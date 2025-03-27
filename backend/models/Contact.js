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
  isArchieved: {
    type: Boolean,
    default: false
  },
  history: [{
    type: Date
  }],
  notes: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Contact', contactSchema); 