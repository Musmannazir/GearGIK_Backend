const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  renter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  renterPhone: {
    type: String,
    default: '',
  },
  renterRegNo: {
    type: String,
    default: '',
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
  },
  pickupLocation: {
    type: String,
    enum: ['FME', 'FCSE', 'AcB', 'FMCE', 'H11/12', 'Brabers', 'H9/10', 'H1/2', 'H5/6', 'H3/4'],
    required: true,
  },
  duration: {
    type: Number,
    required: true, // in hours
  },
  totalCost: {
    type: Number,
    required: true,
  },
  
  // --- NEW FIELD: Track seats for this booking ---
  seatsBooked: {
    type: Number,
    default: 1, // Default to 1 (full car or 1 seat)
  },
  // ----------------------------------------------

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded'],
    default: 'unpaid',
  },
  bookingDate: {
    type: Date,
    required: true,
  },
  returnDate: {
    type: Date,
  },
  feedback: {
    rating: {
      type: Number,
      min: 0,
      max: 5,
    },
    comment: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Booking', bookingSchema);