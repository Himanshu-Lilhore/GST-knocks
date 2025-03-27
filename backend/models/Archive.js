const mongoose = require('mongoose');

const ArchiveSchema = new mongoose.Schema({
    contacts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Contact'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Archive', ArchiveSchema); 