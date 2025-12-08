const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['Sedan', 'SUV', 'Electric', 'Hatchback', 'Van', 'Bike', 'Truck'],
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
  pricePerHour: {
    type: Number,
    required: true,
  },
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
  reviews: {
    type: Number,
    default: 0,
  },
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
