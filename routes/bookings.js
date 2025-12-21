const express = require('express');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Create new booking
router.post('/', auth, async (req, res) => {
  try {
    const { vehicleId, duration, pickupLocation, startTime, phone, regNo, seatsToBook } = req.body;

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

    if (vehicle.owner.toString() === req.userId) {
      return res.status(400).json({ error: 'You cannot rent your own car' });
    }

    const renter = await User.findById(req.userId);
    let totalCost = 0;
    let seatsBookingCount = 1; 

    // --- SEAT SHARING LOGIC ---
    if (vehicle.isShared) {
      seatsBookingCount = parseInt(seatsToBook) || 1;

      if (vehicle.seatsAvailable < seatsBookingCount) {
        return res.status(400).json({ 
          error: `Not enough seats. Only ${vehicle.seatsAvailable} seats left.` 
        });
      }

      // Cost = Price Per Seat * Seats
      totalCost = vehicle.pricePerSeat * seatsBookingCount; 

      // Reduce seats
      vehicle.seatsAvailable -= seatsBookingCount;
      if (vehicle.seatsAvailable <= 0) vehicle.isAvailable = false; 

    } else {
      // FULL RENTAL LOGIC
      if (!vehicle.isAvailable) {
        return res.status(400).json({ error: 'Vehicle is already booked' });
      }
      totalCost = vehicle.pricePerHour * duration;
      vehicle.isAvailable = false;
    }

    const booking = new Booking({
      renter: req.userId,
      renterPhone: phone || renter.phone || '',
      renterRegNo: regNo || '',
      vehicle: vehicleId,
      pickupLocation,
      duration,
      totalCost,
      seatsBooked: seatsBookingCount, // Save seat count
      bookingDate: startTime || Date.now(),
      returnDate: new Date(new Date(startTime || Date.now()).getTime() + duration * 60 * 60 * 1000),
      status: 'pending',
      paymentStatus: 'unpaid',
    });

    await booking.save();
    await vehicle.save(); // Update vehicle seats/availability

    await booking.populate([
      { path: 'renter', select: 'fullName email phone' },
      { path: 'vehicle', select: 'name type pricePerHour pricePerSeat owner' },
    ]);

    res.status(201).json({ message: 'Booking created successfully', booking });
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
      const userVehicles = await Vehicle.find({ owner: req.userId }, '_id');
      filter.vehicle = { $in: userVehicles.map(v => v._id) };
    }

    const bookings = await Booking.find(filter)
      .populate([
        { path: 'renter', select: 'fullName email phone rating' },
        {
          path: 'vehicle',
          select: 'name type pricePerHour pricePerSeat owner location',
          populate: { path: 'owner', select: 'fullName rating' },
        },
      ])
      .sort({ bookingDate: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update booking (Cancel/Complete)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, paymentStatus, feedback } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const vehicle = await Vehicle.findById(booking.vehicle);

    // --- CANCELLATION LOGIC (Restore Seats) ---
    if (status === 'cancelled' && booking.status !== 'cancelled') {
      if (vehicle.isShared) {
        const seatsToRestore = booking.seatsBooked || 1;
        vehicle.seatsAvailable += seatsToRestore;
        if (vehicle.seatsAvailable > 4) vehicle.seatsAvailable = 4;
      }
      vehicle.isAvailable = true; // Make available again
      await vehicle.save();
    }

    if (status) booking.status = status;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (feedback && booking.renter.toString() === req.userId) booking.feedback = feedback;

    await booking.save();
    res.json({ message: 'Booking updated', booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel Booking (Delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const vehicle = await Vehicle.findById(booking.vehicle);
    
    // Restore Seats
    if (vehicle.isShared) {
       const seatsToRestore = booking.seatsBooked || 1;
       vehicle.seatsAvailable += seatsToRestore;
       if (vehicle.seatsAvailable > 4) vehicle.seatsAvailable = 4;
    }
    vehicle.isAvailable = true;
    await vehicle.save();

    booking.status = 'cancelled';
    await booking.save();

    res.json({ message: 'Booking cancelled', booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;