const express = require('express'); // Import Express to create a router
const bcrypt = require('bcryptjs'); // Import Bcrypt for hashing passwords
const passport = require('passport'); // Import Passport for authentication
const jwt = require('jsonwebtoken'); // Import JWT for token generation
const User = require('../models/User'); // Import the User model for employees
const { ensureAuthenticated, ensureRole } = require('../middleware/auth'); // Import authentication middleware
const speakeasy = require('speakeasy'); // Import Speakeasy for 2FA
const qrcode = require('qrcode'); // Import QRCode for generating QR codes
const router = express.Router(); // Create a new router

// Route for employee login
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) throw err; // Handle any errors during authentication
        if (!user) {
            res.status(400).json({ msg: 'No employee exists' }); // If user not found, send error response
        } else {
            req.logIn(user, err => {
                if (err) throw err; // Handle any errors during login
                if (user.twoFactorEnabled) {
                    res.json({ twoFactorRequired: true }); // Indicate that 2FA is required
                } else {
                    const token = jwt.sign({ id: user._id }, 'your_jwt_secret', { expiresIn: '1h' }); // Generate JWT token
                    res.json({ token }); // Send token as response
                }
            });
        }
    })(req, res, next);
});

// Route for managing employee settings
router.get('/settings', ensureAuthenticated, (req, res) => {
    res.render('employee/settings', { user: req.user, qrCodeUrl: null }); // Render settings page with user data
});

// Route to reset password
router.post('/settings/reset-password', ensureAuthenticated, (req, res) => {
    const { currentPassword, newPassword } = req.body; // Extract current and new passwords from the request body

    User.findById(req.user._id).then(user => {
        // Check if current password matches
        bcrypt.compare(currentPassword, user.password, (err, isMatch) => {
            if (err) throw err; // Handle any errors during password comparison
            if (!isMatch) {
                res.status(400).json({ msg: 'Current password is incorrect' }); // Send error if passwords don't match
            } else {
                // Hash new password before saving
                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newPassword, salt, (err, hash) => {
                        if (err) throw err; // Handle any errors during hashing
                        user.password = hash; // Set new hashed password
                        user.save()
                            .then(() => res.json({ msg: 'Password reset successful' })) // Send success response
                            .catch(err => res.status(500).json({ error: err.message })); // Handle save errors
                    });
                });
            }
        });
    });
});

// Route to setup 2FA
router.post('/settings/setup-2fa', ensureAuthenticated, (req, res) => {
    const secret = speakeasy.generateSecret({ length: 20 }); // Generate a secret key for 2FA

    // Save the secret key to the employee's account
    User.findByIdAndUpdate(req.user._id, { twoFactorSecret: secret.base32 }, { new: true })
        .then(user => {
            // Generate a QR code for the secret key
            qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
                if (err) res.status(500).json({ error: err.message }); // Handle QR code generation errors
                else res.render('employee/settings', { user, qrCodeUrl: data_url }); // Render settings page with QR code
            });
        })
        .catch(err => res.status(500).json({ error: err.message })); // Handle database update errors
});

// Route to verify 2FA code
router.post('/settings/verify-2fa', ensureAuthenticated, (req, res) => {
    const { token } = req.body; // Extract the 2FA token from the request body

    // Verify the token using the user's secret
    const verified = speakeasy.totp.verify({
        secret: req.user.twoFactorSecret,
        encoding: 'base32',
        token
    });

    if (verified) {
        // If token is verified, enable 2FA for the user
        User.findByIdAndUpdate(req.user._id, { twoFactorEnabled: true }, { new: true })
            .then(user => res.render('employee/settings', { user, qrCodeUrl: null })) // Render settings page without QR code
            .catch(err => res.status(500).json({ error: err.message })); // Handle database update errors
    } else {
        res.status(400).json({ msg: 'Invalid 2FA token' }); // Send error if token verification fails
    }
});

// Route to disable 2FA
router.post('/settings/disable-2fa', ensureAuthenticated, (req, res) => {
    // Disable 2FA for the user
    User.findByIdAndUpdate(req.user._id, { twoFactorEnabled: false, twoFactorSecret: null }, { new: true })
        .then(user => res.render('employee/settings', { user, qrCodeUrl: null })) // Render settings page without QR code
        .catch(err => res.status(500).json({ error: err.message })); // Handle database update errors
});

module.exports = router; // Export the router
