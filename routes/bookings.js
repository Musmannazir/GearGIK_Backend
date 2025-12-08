const express = require('express');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Create new booking
router.post('/', auth, async (req, res) => {
  try {
    const { vehicleId, duration, pickupLocation, startTime, phone, regNo } = req.body;

    // Check if vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Check if user is trying to rent their own car
    if (vehicle.owner.toString() === req.userId) {
      return res.status(400).json({ error: 'You cannot rent your own car' });
    }

    // Check if vehicle is available
    if (!vehicle.isAvailable) {
      return res.status(400).json({ error: 'Vehicle is already booked' });
    }

    // Get renter info
    const renter = await User.findById(req.userId);

    // Calculate total cost
    const totalCost = vehicle.pricePerHour * duration;

    const booking = new Booking({
      renter: req.userId,
      renterPhone: phone || renter.phone || '',
      renterRegNo: regNo || '',
      vehicle: vehicleId,
      pickupLocation,
      duration,
      totalCost,
      bookingDate: startTime || Date.now(),
      returnDate: new Date(new Date(startTime || Date.now()).getTime() + duration * 60 * 60 * 1000),
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    await booking.save();

    // Mark vehicle as unavailable
    await Vehicle.findByIdAndUpdate(vehicleId, { isAvailable: false });

    await booking.populate([
      { path: 'renter', select: 'fullName email phone' },
      { path: 'vehicle', select: 'name type pricePerHour owner' },
    ]);

    res.status(201).json({
      message: 'Booking created successfully',
      booking,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's bookings
router.get('/', auth, async (req, res) => {
  try {
    const { role } = req.query;

    let filter = {};

    if (role === 'renter') {
      filter.renter = req.userId;
    } else if (role === 'owner') {
      // Get bookings for vehicles owned by this user
      const userVehicles = await Vehicle.find({ owner: req.userId }, '_id');
      const vehicleIds = userVehicles.map((v) => v._id);
      filter.vehicle = { $in: vehicleIds };
    }

    const bookings = await Booking.find(filter)
      .populate([
        { path: 'renter', select: 'fullName email phone rating' },
        {
          path: 'vehicle',
          select: 'name type pricePerHour owner location',
          populate: { path: 'owner', select: 'fullName rating' },
        },
      ])
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single booking
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate([
        { path: 'renter', select: 'fullName email phone rating' },
        {
          path: 'vehicle',
          select: 'name type pricePerHour owner location image',
          populate: { path: 'owner', select: 'fullName rating email phone' },
        },
      ]);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    const isRenter = booking.renter._id.toString() === req.userId;
    const vehicle = await Vehicle.findById(booking.vehicle._id);
    const isOwner = vehicle.owner.toString() === req.userId;

    if (!isRenter && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to view this booking' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking status (owner or renter)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, paymentStatus, feedback } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    const isRenter = booking.renter.toString() === req.userId;
    const vehicle = await Vehicle.findById(booking.vehicle);
    const isOwner = vehicle.owner.toString() === req.userId;

    if (!isRenter && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to update this booking' });
    }

    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;

    // Only renter can add feedback
    if (feedback && isRenter) {
      booking.feedback = feedback;
    }

    // Update vehicle's total bookings and mark as available if completed
    if (status === 'completed') {
      vehicle.totalBookings = (vehicle.totalBookings || 0) + 1;
      vehicle.isAvailable = true; // Mark as available after booking completes
      if (feedback && feedback.rating) {
        vehicle.reviews.push(feedback.rating);
        vehicle.rating =
          vehicle.reviews.reduce((a, b) => a + b, 0) / vehicle.reviews.length;
      }
      await vehicle.save();

      // Update owner's earnings
      const owner = await User.findById(vehicle.owner);
      owner.totalEarnings = (owner.totalEarnings || 0) + booking.totalCost;
      await owner.save();
    }

    // Mark as available if booking is cancelled
    if (status === 'cancelled') {
      vehicle.isAvailable = true;
      await vehicle.save();
    }

    await booking.save();
    await booking.populate([
      { path: 'renter', select: 'fullName email phone' },
      { path: 'vehicle', select: 'name type pricePerHour owner' },
    ]);

    res.json({
      message: 'Booking updated successfully',
      booking,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel booking
router.delete('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check authorization
    if (booking.renter.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this booking' });
    }

    // Can only cancel pending bookings
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Can only cancel pending or confirmed bookings' });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled successfully', booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
