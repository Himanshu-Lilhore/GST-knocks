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
  // console.log('Excel rows:', rows); // Debug log
  
  const contacts = [];
  
  // Find column indices from header row
  const headerRow = rows[0] || [];
  
  // Find GSTIN column (usually contains business registration numbers)
  const gstinColumnIndex = headerRow.findIndex(col => 
    typeof col === 'string' && col.toUpperCase().includes('GSTIN')
  );
  
  // Find name column - look for variations
  const nameColumnIndex = headerRow.findIndex(col => 
    typeof col === 'string' && (
      col.toUpperCase().includes('TRADE NAME') ||
      col.toUpperCase().includes('NAME') ||
      col.toUpperCase().includes('BUSINESS')
    )
  );
  
  // Find phone column - look for variations
  const phoneColumnIndex = headerRow.findIndex(col => 
    typeof col === 'string' && (
      col.toUpperCase().includes('MOBILE') ||
      col.toUpperCase().includes('PHONE') ||
      col.toUpperCase().includes('CONTACT')
    )
  );
  
  // console.log('Column indices - GSTIN:', gstinColumnIndex, 'Name:', nameColumnIndex, 'Phone:', phoneColumnIndex);
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue; // Skip empty rows
    
    let name = 'Unknown';
    let phoneNumber = '';
    let gstin = '';
    
    // First try to get phone number - we'll look in all columns if needed
    if (phoneColumnIndex !== -1) {
      // Try the identified phone column first
      phoneNumber = row[phoneColumnIndex]?.toString().trim() || '';
    }
    
    // If phone number not found in the expected column, look through all columns
    if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
      for (let j = 0; j < row.length; j++) {
        const cellValue = row[j]?.toString().trim() || '';
        if (/^\d{10}$/.test(cellValue)) {
          phoneNumber = cellValue;
          break;
        }
      }
    }
    
    // Try to get name from the name column if it exists
    if (nameColumnIndex !== -1 && row[nameColumnIndex]) {
      const nameValue = row[nameColumnIndex]?.toString().trim() || '';
      if (nameValue) {
        name = nameValue
          .replace(/^M\/S\.?\s*/i, '')
          .replace(/^M\/S\s*/i, '')
          .replace(/\s+IGST\s+STLMT/i, '')
          .replace(/\s+CTI/i, '')
          .replace(/\s+STO/i, '')
          .trim();
      }
    }
    
    // Get GSTIN if available
    if (gstinColumnIndex !== -1 && row[gstinColumnIndex]) {
      gstin = row[gstinColumnIndex]?.toString().trim() || '';
    }
    
    // If we have a valid phone number, add the contact (name will be "Unknown" if not found)
    if (phoneNumber && /^\d{10}$/.test(phoneNumber)) {
      contacts.push({ name, phoneNumber, gstin });
    }
  }
  
  // console.log('Extracted contacts from Excel:', contacts); // Debug log
  return contacts;
};

// Extract contacts from text
const extractContacts = (text) => {
  // console.log('Raw PDF text:', text); // Debug log
  
  // Split text into lines and remove empty lines
  const lines = text.split('\n').filter(line => line.trim());
  // console.log('Lines:', lines); // Debug log
  
  // Skip the header lines
  const dataLines = lines.slice(3); // Skip SR NO, GSTIN line, and OFFICER NAME line
  // console.log('Data lines:', dataLines); // Debug log
  
  const contacts = [];
  let currentName = 'Unknown';
  let currentPhoneNumber = '';
  let currentGSTIN = '';
  
  // Process each line
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i].trim();
    if (!line || /^\d+$/.test(line)) continue; // Skip empty lines and lines that are just numbers
    
    // console.log('Processing line:', line); // Debug log
    
    // Try to find GSTIN first as it's the most reliable identifier
    const gstinMatch = line.match(/([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/);
    if (gstinMatch) {
      // If we have a complete contact from previous iteration, save it
      if (currentPhoneNumber && /^\d{10}$/.test(currentPhoneNumber)) {
        contacts.push({
          name: currentName,
          phoneNumber: currentPhoneNumber,
          gstin: currentGSTIN || ''
        });
      }
      
      // Start new contact
      currentGSTIN = gstinMatch[1];
      currentName = 'Unknown';
      currentPhoneNumber = '';
      
      // Try to extract name after GSTIN
      const afterGSTIN = line.substring(line.indexOf(currentGSTIN) + currentGSTIN.length);
      if (afterGSTIN) {
        const nameValue = afterGSTIN
          .replace(/^M\/S\.?\s*/i, '')
          .replace(/^M\/S\s*/i, '')
          .replace(/\s+IGST\s+STLMT/i, '')
          .replace(/\s+CTI/i, '')
          .replace(/\s+STO/i, '')
          .trim();
        
        if (nameValue && !nameValue.includes('JI')) {
          currentName = nameValue;
        }
      }
      
      // Look ahead for phone number in next 3 lines
      for (let j = 1; j <= 3 && i + j < dataLines.length; j++) {
        const nextLine = dataLines[i + j].trim();
        const phoneMatch = nextLine.match(/\d{10}/);
        if (phoneMatch) {
          currentPhoneNumber = phoneMatch[0];
          break;
        }
      }
    } else {
      // If not a GSTIN line, check for phone number
      const phoneMatch = line.match(/\d{10}/);
      if (phoneMatch) {
        currentPhoneNumber = phoneMatch[0];
        
        // If we have all required info, save the contact
        if (currentPhoneNumber && /^\d{10}$/.test(currentPhoneNumber)) {
          contacts.push({
            name: currentName,
            phoneNumber: currentPhoneNumber,
            gstin: currentGSTIN || ''
          });
          
          // Reset for next contact
          currentName = 'Unknown';
          currentPhoneNumber = '';
          currentGSTIN = '';
        }
      } else if (!line.includes('JI')) {
        // If line doesn't contain GSTIN, phone, or "JI", it might be additional name info
        const nameValue = line
          .replace(/^M\/S\.?\s*/i, '')
          .replace(/^M\/S\s*/i, '')
          .replace(/\s+IGST\s+STLMT/i, '')
          .replace(/\s+CTI/i, '')
          .replace(/\s+STO/i, '')
          .trim();
        
        if (nameValue) {
          if (currentName === 'Unknown') {
            currentName = nameValue;
          } else {
            currentName = `${currentName} ${nameValue}`.trim();
          }
        }
      }
    }
  }
  
  // Handle any remaining contact at the end
  if (currentPhoneNumber && /^\d{10}$/.test(currentPhoneNumber)) {
    contacts.push({
      name: currentName,
      phoneNumber: currentPhoneNumber,
      gstin: currentGSTIN || ''
    });
  }
  
  // console.log('Extracted contacts:', contacts); // Debug log
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
          // First check if contact exists
          const existingContact = await Contact.findOne({ phoneNumber: contact.phoneNumber });
          
          // If contact exists, we'll reset its status to pending
          if (existingContact) {
            return await Contact.findOneAndUpdate(
              { phoneNumber: contact.phoneNumber },
              { 
                phoneNumber: contact.phoneNumber,
                name: contact.name,
                gstin: contact.gstin || '',
                called: false,  // Reset to not called
                callDate: null  // Clear call date
              },
              { new: true }
            );
          }
          
          // If contact doesn't exist, create new one
          return await Contact.create({
            phoneNumber: contact.phoneNumber,
            name: contact.name,
            gstin: contact.gstin || '',
            called: false,
            callDate: null
          });
        } catch (error) {
          console.error(`Error saving contact ${contact.phoneNumber}:`, error);
          return null;
        }
      })
    );

    // Count how many were updated vs new
    const updatedCount = savedContacts.filter(c => c && c.callDate === null).length;
    const totalCount = savedContacts.filter(n => n).length;

    res.json({ 
      success: true, 
      contacts: savedContacts.filter(n => n),
      message: `Successfully processed ${totalCount} contacts (${updatedCount} reset to pending)`
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


// Create a new contact manually
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phoneNumber, gstin } = req.body;
    
    // Check required fields
    if (!name || !phoneNumber) {
      return res.status(400).json({ success: false, error: 'Name and phone number are required' });
    }
    
    // Check for duplicate contact by phone number
    const existingContact = await Contact.findOne({ phoneNumber });
    if (existingContact) {
      return res.status(400).json({ success: false, error: 'Contact with this phone number already exists' });
    }
    
    // Create new contact with status "pending" (i.e. not called)
    const newContact = await Contact.create({
      name,
      phoneNumber,
      gstin: gstin || '',
      called: false,
      callDate: null
    });
    
    res.json({ success: true, contact: newContact });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 