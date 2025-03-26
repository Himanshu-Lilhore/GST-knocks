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
  console.log('Raw PDF text:', text); // Debug log
  
  // Split text into lines and remove empty lines
  const lines = text.split('\n').filter(line => line.trim());
  console.log('Lines:', lines); // Debug log
  
  // Skip the header lines
  const dataLines = lines.slice(3); // Skip SR NO, GSTIN line, and OFFICER NAME line
  console.log('Data lines:', dataLines); // Debug log
  
  const contacts = [];
  let currentName = '';
  let currentPhoneNumber = '';
  
  dataLines.forEach((line, index) => {
    // Skip empty lines and lines that are just numbers (SR NO)
    if (!line.trim() || /^\d+$/.test(line.trim())) {
      return;
    }
    
    console.log('Processing line:', line); // Debug log
    
    // Check if this line contains a phone number
    const phoneMatch = line.match(/\d{10}/);
    if (phoneMatch) {
      currentPhoneNumber = phoneMatch[0];
      console.log('Found phone number:', currentPhoneNumber); // Debug log
      
      // If we have a name, create the contact
      if (currentName) {
        console.log('Using previous name:', currentName); // Debug log
        contacts.push({
          name: currentName,
          phoneNumber: currentPhoneNumber
        });
        currentName = '';
        currentPhoneNumber = '';
      }
    } else {
      // This line might contain a name
      // Look for GSTIN pattern to identify the start of a new entry
      const hasGSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/.test(line);
      
      if (hasGSTIN) {
        // Extract name after GSTIN
        const nameMatch = line.match(/[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}(.*?)(?:IGST STLMT|$)/);
        if (nameMatch) {
          currentName = nameMatch[1]
            .replace(/^M\/S\.?\s*/i, '') // Remove M/S. or M/S
            .replace(/^M\/S\s*/i, '')    // Remove M/S
            .replace(/\s+IGST\s+STLMT/i, '') // Remove IGST STLMT
            .replace(/\s+CTI/i, '')      // Remove CTI
            .replace(/\s+STO/i, '')      // Remove STO
            .trim();
          console.log('Found name from GSTIN line:', currentName); // Debug log
        }
      } else if (!line.includes('JI')) {
        // If line doesn't contain 'JI' (officer name), it might be a continuation of the name
        currentName = line
          .replace(/^M\/S\.?\s*/i, '')
          .replace(/^M\/S\s*/i, '')
          .replace(/\s+IGST\s+STLMT/i, '')
          .replace(/\s+CTI/i, '')
          .replace(/\s+STO/i, '')
          .trim();
        console.log('Found continuation name:', currentName); // Debug log
      }
    }
    
    // Check if the next line contains a phone number
    if (currentName && !currentPhoneNumber && index < dataLines.length - 1) {
      const nextLine = dataLines[index + 1];
      const nextPhoneMatch = nextLine.match(/\d{10}/);
      if (nextPhoneMatch) {
        currentPhoneNumber = nextPhoneMatch[0];
        console.log('Found phone number on next line:', currentPhoneNumber); // Debug log
        contacts.push({
          name: currentName,
          phoneNumber: currentPhoneNumber
        });
        currentName = '';
        currentPhoneNumber = '';
      }
    }
  });
  
  console.log('Extracted contacts:', contacts); // Debug log
  return contacts;
};

// Upload PDF and extract contacts
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    const pdfData = await pdf(req.file.buffer);
    console.log('PDF parsed successfully'); // Debug log
    
    const contacts = extractContacts(pdfData.text);
    console.log('Number of contacts extracted:', contacts.length); // Debug log

    if (contacts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No contacts found in the PDF. Please check the format.' 
      });
    }

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

    res.json({ 
      success: true, 
      contacts: savedContacts.filter(n => n),
      message: `Successfully processed ${savedContacts.filter(n => n).length} contacts`
    });
  } catch (error) {
    console.error('PDF processing error:', error); // Debug log
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