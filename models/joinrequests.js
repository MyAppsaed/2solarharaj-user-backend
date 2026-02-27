const mongoose = require('mongoose');

const joinrequestsSchema = new mongoose.Schema({
    email: { type: String, required: true },
    type: { type: String, required: true },
    content: { type: String, required: true },
    phoneNumber: { type: String },
    createdAt: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model('Joinrequests', joinrequestsSchema);