const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const pdf = require('pdf-parse');
const cors = require('cors');
const Contact = require('./models/Contact');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://himanshu-lilhore.github.io',
      process.env.FRONTEND_URL
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT'],
  credentials: true
}));
app.use(express.json());

// Multer configuration for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Extract phone numbers from text
const extractPhoneNumbers = (text) => {
  const phoneRegex = /(\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;
  return [...new Set(text.match(phoneRegex) || [])];
};

// Upload PDF and extract numbers
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    const pdfData = await pdf(req.file.buffer);
    const phoneNumbers = extractPhoneNumbers(pdfData.text);

    // Save to database
    const savedNumbers = await Promise.all(
      phoneNumbers.map(async (number) => {
        try {
          return await Contact.findOneAndUpdate(
            { phoneNumber: number },
            { phoneNumber: number },
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error saving number ${number}:`, error);
          return null;
        }
      })
    );

    res.json({ success: true, contacts: savedNumbers.filter(n => n) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ called: 1, createdAt: 1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact status
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { called: true, callDate: new Date() },
      { new: true }
    );
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 