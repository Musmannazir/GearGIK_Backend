const express = require('express');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all vehicles
router.get('/', async (req, res) => {
  try {
    const { type, location, minPrice, maxPrice } = req.query;

    let filter = { isAvailable: true };

    if (type) filter.type = type;
    if (location) filter.location = location;
    if (minPrice || maxPrice) {
      filter.pricePerHour = {};
      if (minPrice) filter.pricePerHour.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerHour.$lte = Number(maxPrice);
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

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add new vehicle (authenticated users)
router.post('/', auth, async (req, res) => {
  try {
    const { name, type, pricePerHour, location, image, features, phone, regNo } = req.body;

    const owner = await User.findById(req.userId);

    const vehicle = new Vehicle({
      name,
      type,
      owner: req.userId,
      ownerPhone: phone || owner.phone || '',
      ownerRegNo: regNo || '',
      pricePerHour,
      location,
      image,
      features: features || [],
    });

    await vehicle.save();
    await vehicle.populate('owner', 'fullName rating reviews');

    res.status(201).json({
      message: 'Vehicle added successfully',
      vehicle,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update vehicle (owner only)
router.put('/:id', auth, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Check if user is owner
    if (vehicle.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to update this vehicle' });
    }

    const { name, type, pricePerHour, location, features, isAvailable } = req.body;

    vehicle.name = name || vehicle.name;
    vehicle.type = type || vehicle.type;
    vehicle.pricePerHour = pricePerHour || vehicle.pricePerHour;
    vehicle.location = location || vehicle.location;
    vehicle.features = features || vehicle.features;
    vehicle.isAvailable = isAvailable !== undefined ? isAvailable : vehicle.isAvailable;
    vehicle.updatedAt = Date.now();

    await vehicle.save();
    await vehicle.populate('owner', 'fullName rating reviews');

    res.json({
      message: 'Vehicle updated successfully',
      vehicle,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete vehicle (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    // Check if user is owner
    if (vehicle.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this vehicle' });
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
