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
  // methods: ['GET', 'POST', 'PUT'],
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

// Extract contacts from text
const extractContacts = (text) => {
  // Split text into lines and remove empty lines
  const lines = text.split('\n').filter(line => line.trim());
  
  // Skip the header line
  const dataLines = lines.slice(1);
  
  const contacts = [];
  
  dataLines.forEach(line => {
    // Split the line by whitespace
    const parts = line.trim().split(/\s+/);
    
    // Find the phone number (last 10 digits in the line)
    const phoneMatch = line.match(/\d{10}/);
    if (!phoneMatch) return;
    
    const phoneNumber = phoneMatch[0];
    
    // Find the trade name (starts after GSTIN and before the officer name)
    const gstinIndex = parts.findIndex(part => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(part));
    const officerIndex = parts.findIndex(part => part.includes('JI'));
    
    if (gstinIndex === -1 || officerIndex === -1) return;
    
    // Get the trade name (everything between GSTIN and officer name)
    const tradeName = parts.slice(gstinIndex + 1, officerIndex).join(' ');
    
    // Clean up the trade name
    const cleanName = tradeName
      .replace(/^M\/S\.?\s*/i, '') // Remove M/S. or M/S
      .replace(/^M\/S\s*/i, '')    // Remove M/S
      .replace(/\s+IGST\s+STLMT/i, '') // Remove IGST STLMT
      .replace(/\s+CTI/i, '')      // Remove CTI
      .replace(/\s+STO/i, '')      // Remove STO
      .trim();
    
    contacts.push({
      name: cleanName || 'Unknown',
      phoneNumber: phoneNumber
    });
  });
  
  return contacts;
};

// Upload PDF and extract contacts
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    const pdfData = await pdf(req.file.buffer);
    const contacts = extractContacts(pdfData.text);

    // Save to database
    const savedContacts = await Promise.all(
      contacts.map(async (contact) => {
        try {
          return await Contact.findOneAndUpdate(
            { phoneNumber: contact.phoneNumber },
            { 
              phoneNumber: contact.phoneNumber,
              name: contact.name
            },
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error saving contact ${contact.phoneNumber}:`, error);
          return null;
        }
      })
    );

    res.json({ success: true, contacts: savedContacts.filter(n => n) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ 
      called: 1,  // Uncalled contacts first
      callDate: -1,  // Most recently called first within called contacts
      createdAt: 1  // For uncalled contacts, oldest first
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update contact status
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const update = status === 'pending' 
      ? { called: false, callDate: null }
      : { called: true, callDate: new Date() };
    
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete contact
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 