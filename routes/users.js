const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/User');
const { ensureAuthenticated, ensureRoles } = require('../middleware/auth');
const router = express.Router();

// Route to display the registration form
router.get('/register', (req, res) => {
    console.log('Register route accessed');
    res.render('register', { title: 'Register' });
});

// Route to handle user registration
router.post('/register', (req, res) => {
    const { name, email, password, role } = req.body;
    console.log('Register POST request received');

    // Basic validation
    let errors = [];
    if (!name || !email || !password || !role) {
        errors.push({ msg: 'Please enter all fields' });
    }

    if (errors.length > 0) {
        console.log('Validation errors:', errors);
        res.render('register', { errors, name, email, password, role });
    } else {
        // Check if the user already exists
        User.findOne({ email }).then(user => {
            if (user) {
                errors.push({ msg: 'Email already exists' });
                res.render('register', { errors, name, email, password, role });
            } else {
                const newUser = new User({ name, email, password, role });

                // Hash the password before saving
                bcrypt.genSalt(10, (err, salt) => {
                    if (err) throw err;
                    bcrypt.hash(newUser.password, salt, (err, hash) => {
                        if (err) throw err;
                        newUser.password = hash;

                        newUser.save()
                            .then(user => {
                                console.log('New user registered:', user);
                                req.flash('success_msg', 'You are now registered and can log in');
                                res.redirect('/login'); // Redirect to the login page
                            })
                            .catch(err => console.error(err));
                    });
                });
            }
        });
    }
});

// Route to display the login form
router.get('/login', (req, res) => {
    console.log('Login route accessed');
    res.render('login', { title: 'Login' });
});

// Route to handle user login
router.post('/login', (req, res, next) => {
    console.log('Login POST request received');
    passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/login',
        failureFlash: true
    })(req, res, next);
});

// Route to handle user logout
router.get('/logout', (req, res) => {
    console.log('Logout route accessed');
    req.logout(err => {
        if (err) return next(err);
        req.flash('success_msg', 'You are logged out');
        res.redirect('/login');
    });
});

// Route to display user management page
router.get('/user-management', ensureAuthenticated, ensureRoles(['admin']), async (req, res) => {
    console.log('User Management route accessed');
    try {
        const users = await User.find();
        console.log('Users fetched:', users);
        res.render('user_management', { title: 'User Management', users });
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Route to edit user details
router.get('/:id/edit', ensureAuthenticated, ensureRoles(['admin']), async (req, res) => {
    const userId = req.params.id;
    console.log(`Fetching user details for editing with ID: ${userId}`);

    try {
        const user = await User.findById(userId).exec();
        if (!user) {
            console.error(`User with ID ${userId} not found`);
            return res.status(404).render('404', { message: 'User not found' });
        }
        console.log(`User details fetched for editing: ${user}`);
        res.render('edit_user', { title: 'Edit User', user });
    } catch (err) {
        console.error(`Error fetching user details for editing: ${err}`);
        res.status(500).render('500', { message: 'Internal Server Error' });
    }
});

// Route to handle user update
router.put('/:id', ensureAuthenticated, ensureRoles(['admin']), async (req, res) => {
    const userId = req.params.id;
    console.log(`Updating user with ID: ${userId}`);

    try {
        let user = await User.findById(userId).exec();
        if (!user) {
            console.error(`User with ID ${userId} not found`);
            return res.status(404).json({ error: 'User not found' });
        }

        const { name, email, role, password } = req.body;

        if (password) {
            // Hash the new password before saving
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            user.password = hash;
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.role = role || user.role;

        user = await user.save();
        console.log('User updated:', user);
        res.redirect('/user-management');
    } catch (err) {
        console.error(`Error updating user: ${err}`);
        res.status(500).json({ error: err.message });
    }
});

// Route to handle user deletion
router.delete('/:id', ensureAuthenticated, ensureRoles(['admin']), async (req, res) => {
    const userId = req.params.id;
    console.log(`Deleting user with ID: ${userId}`);

    try {
        await User.findByIdAndDelete(userId);
        console.log('User deleted:', userId);
        res.redirect('/user-management');
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
