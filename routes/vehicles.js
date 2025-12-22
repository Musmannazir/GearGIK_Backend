const express = require('express');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all vehicles (Updated with Seat Sharing Filter)
router.get('/', async (req, res) => {
  try {
    const { type, location, minPrice, maxPrice, isShared } = req.query;

    // Default: Show available vehicles
    let filter = { isAvailable: true };

    if (type && type !== 'All Types') filter.type = type;
    if (location) filter.location = location;
    
    // --- SEAT SHARING LOGIC ---
    if (isShared === 'true') {
      filter.isShared = true;
      filter.seatsAvailable = { $gt: 0 }; // Only show cars with seats left
    } else {
      // If user wants full rental, hide cars that are strictly for sharing
      // (Optional: remove this line if you want to see everything mixed)
      filter.isShared = false; 
    }

    if (minPrice || maxPrice) {
      // Check pricePerSeat OR pricePerHour based on mode
      const priceField = isShared === 'true' ? 'pricePerSeat' : 'pricePerHour';
      filter[priceField] = {};
      if (minPrice) filter[priceField].$gte = Number(minPrice);
      if (maxPrice) filter[priceField].$lte = Number(maxPrice);
    }

    const vehicles = await Vehicle.find(filter)
      .populate('owner', 'fullName rating reviews')
      .sort({ createdAt: -1 });

    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single vehicle
router.get('/:id', async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate('owner', 'fullName rating reviews email phone');
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new vehicle (Updated for Seat Sharing)
router.post('/', auth, async (req, res) => {
  try {
    const { 
      name, type, pricePerHour, maxDuration, location, 
      image, features, phone, regNo, 
      isShared, pricePerSeat 
    } = req.body;

    const owner = await User.findById(req.userId);

    // LOGIC: Only Cars can be shared (No bikes)
    const isCar = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Truck'].includes(type);
    const validShared = isCar && isShared;

    const vehicle = new Vehicle({
      name,
      type,
      owner: req.userId,
      ownerPhone: phone || owner.phone || '',
      ownerRegNo: regNo || '',
      
      // If sharing, pricePerHour is 0 (or irrelevant)
      pricePerHour: validShared ? 0 : pricePerHour,
      maxDuration: maxDuration || 24,
      
      location,
      image,
      features: features || [],
      
      // --- NEW FIELDS ---
      isShared: validShared,
      pricePerSeat: validShared ? Number(pricePerSeat) : 0,
      seatsAvailable: validShared ? 4 : 0, // Default 4 seats
    });

    await vehicle.save();
    await vehicle.populate('owner', 'fullName rating reviews');

    res.status(201).json({ message: 'Vehicle added successfully', vehicle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// inside router.post('/', verifyToken, async (req, res) => { ...

// 1. Fetch the user first
const user = await User.findById(req.user.id);

// 2. Check for Debt (Block if >= 60)
if (user.debt >= 60) {
  return res.status(403).json({ error: "Access Denied: Please pay your outstanding platform fees." });
}

// 3. Check for Limit (Block if 3 ads & not approved)
// Note: You might need to count their actual vehicles instead of relying on 'adsPosted' counter if you want to be precise, but using the counter is faster.
if (user.adsPosted >= 3 && !user.isApproved) {
  return res.status(403).json({ error: "Limit Reached: You need Admin Approval to post more than 3 ads." });
}

// ... Code to create vehicle ...

// 4. If successful, increment adsPosted
user.adsPosted += 1;
await user.save();

// Update vehicle
router.put('/:id', auth, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    if (vehicle.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = req.body;
    Object.keys(updates).forEach((key) => {
      vehicle[key] = updates[key];
    });

    // Reset seats if switching to shared mode
    if (updates.isShared && !vehicle.isShared) {
      vehicle.seatsAvailable = 4;
    }

    vehicle.updatedAt = Date.now();
    await vehicle.save();
    res.json({ message: 'Vehicle updated successfully', vehicle });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete vehicle
router.delete('/:id', auth, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    if (vehicle.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await Vehicle.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's vehicles
router.get('/owner/:userId', async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ owner: req.params.userId })
      .populate('owner', 'fullName rating reviews');
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
