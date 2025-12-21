const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    // Added 'Coupe' to match your frontend options
    enum: ['Sedan', 'SUV', 'Electric', 'Hatchback', 'Van', 'Bike', 'Truck', 'Coupe', 'All Types'],
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ownerPhone: {
    type: String,
    default: '',
  },
  ownerRegNo: {
    type: String,
    default: '',
  },
  
  // --- PRICING & LIMITS ---
  pricePerHour: {
    type: Number,
    required: true, // This is 0 if seat sharing is enabled
  },
  maxDuration: {
    type: Number,
    default: 24, // Limit rental duration (default 24h)
  },
  
  // --- NEW: SEAT SHARING FIELDS ---
  isShared: {
    type: Boolean,
    default: false, // True = Seat Sharing Mode
  },
  pricePerSeat: {
    type: Number,
    default: 0,
  },
  seatsAvailable: {
    type: Number,
    default: 4, // Default capacity for cars
  },
  // -------------------------------

  location: {
    type: String,
    enum: ['FME', 'FCSE', 'AcB', 'FMCE', 'H11/12', 'Brabers', 'H9/10', 'H1/2', 'H5/6', 'H3/4'],
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  features: [{
    type: String,
  }],
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5,
  },
  // Changed to Array to support rating calculation
  reviews: [{ 
    type: Number 
  }],
  totalBookings: {
    type: Number,
    default: 0,
  },
  isAvailable: {
    type: Boolean,
    default: true,
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

module.exports = mongoose.model('Vehicle', vehicleSchema);