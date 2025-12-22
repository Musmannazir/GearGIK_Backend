const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

// 1. Get All Data for Admin Dashboard
router.get('/data', async (req, res) => {
  try {
    const users = await User.find({}).select('-password'); // Hide passwords
    const vehicles = await Vehicle.find({}).populate('owner', 'fullName email');
    res.json({ users, vehicles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Clear Debt (When Admin clicks "Clear Bill")
router.put('/users/:id/clear-debt', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.debt = 0;
    await user.save();
    res.json({ message: "Debt cleared", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Approve Account (When Admin clicks "Approve Account")
router.put('/users/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isApproved = true;
    await user.save();
    res.json({ message: "Account approved", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;