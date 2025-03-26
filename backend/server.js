const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const pdf = require('pdf-parse');
const xlsx = require('xlsx');
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

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and Excel files are allowed!'), false);
    }
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Extract contacts from Excel
const extractContactsFromExcel = (buffer) => {
  const workbook = xlsx.read(buffer);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert sheet to JSON
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('Excel rows:', rows); // Debug log
  
  const contacts = [];
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 7) continue; // Skip empty or invalid rows
    
    // Excel columns: SR NO, GSTIN, TRADE NAME, RETURN STATUS, empty, OFFICER NAME, MobileNo
    const name = row[2]?.toString().trim() || '';
    const phoneNumber = row[6]?.toString().trim() || '';
    
    // Validate phone number (10 digits)
    if (name && phoneNumber && /^\d{10}$/.test(phoneNumber)) {
      contacts.push({
        name: name
          .replace(/^M\/S\.?\s*/i, '')
          .replace(/^M\/S\s*/i, '')
          .replace(/\s+IGST\s+STLMT/i, '')
          .replace(/\s+CTI/i, '')
          .replace(/\s+STO/i, '')
          .trim(),
        phoneNumber: phoneNumber
      });
    }
  }
  
  console.log('Extracted contacts from Excel:', contacts); // Debug log
  return contacts;
};

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
  let isCollectingName = false;
  let lookingForNumber = false;
  
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
        isCollectingName = false;
        lookingForNumber = false;
      }
    } else {
      // This line might contain a name
      // Look for GSTIN pattern to identify the start of a new entry
      const hasGSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}/.test(line);
      
      if (hasGSTIN) {
        // If we were looking for a number for the previous entry, check next few lines
        if (lookingForNumber && currentName) {
          for (let i = 1; i <= 3; i++) {
            if (index + i < dataLines.length) {
              const nextLine = dataLines[index + i];
              const nextPhoneMatch = nextLine.match(/\d{10}/);
              if (nextPhoneMatch) {
                contacts.push({
                  name: currentName,
                  phoneNumber: nextPhoneMatch[0]
                });
                break;
              }
            }
          }
        }
        
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
          isCollectingName = true;
          lookingForNumber = true;
        }
      } else if (!line.includes('JI') && isCollectingName) {
        // If we're collecting a name and this line doesn't contain 'JI', append it
        const additionalName = line
          .replace(/^M\/S\.?\s*/i, '')
          .replace(/^M\/S\s*/i, '')
          .replace(/\s+IGST\s+STLMT/i, '')
          .replace(/\s+CTI/i, '')
          .replace(/\s+STO/i, '')
          .trim();
        
        if (additionalName) {
          currentName = (currentName + ' ' + additionalName).trim();
          console.log('Appended to name:', currentName); // Debug log
        }
      }
    }
    
    // Check if the next line contains a phone number
    if (currentName && !currentPhoneNumber && index < dataLines.length - 1) {
      // Look ahead up to 3 lines for a phone number
      for (let i = 1; i <= 3; i++) {
        if (index + i < dataLines.length) {
          const nextLine = dataLines[index + i];
          const nextPhoneMatch = nextLine.match(/\d{10}/);
          if (nextPhoneMatch) {
            currentPhoneNumber = nextPhoneMatch[0];
            console.log('Found phone number in next lines:', currentPhoneNumber); // Debug log
            contacts.push({
              name: currentName,
              phoneNumber: currentPhoneNumber
            });
            currentName = '';
            currentPhoneNumber = '';
            isCollectingName = false;
            lookingForNumber = false;
            break;
          }
        }
      }
    }
  });
  
  // Final check for any remaining entries
  if (currentName && lookingForNumber) {
    // Look at the last few lines for any remaining phone numbers
    const lastLines = dataLines.slice(-5); // Look at the last 5 lines
    for (const line of lastLines) {
      const phoneMatch = line.match(/\d{10}/);
      if (phoneMatch) {
        console.log('Found final phone number:', phoneMatch[0]); // Debug log
        contacts.push({
          name: currentName,
          phoneNumber: phoneMatch[0]
        });
        break;
      }
    }
  }
  
  console.log('Extracted contacts:', contacts); // Debug log
  return contacts;
};

// Upload file and extract contacts
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Processing file:', req.file.mimetype);
    let contacts;
    
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdf(req.file.buffer);
      contacts = extractContacts(pdfData.text);
    } else {
      // Excel file
      contacts = extractContactsFromExcel(req.file.buffer);
    }
    
    console.log('Number of contacts extracted:', contacts.length);

    if (contacts.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No contacts found in the file. Please check the format.' 
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
    console.error('File processing error:', error);
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