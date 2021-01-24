const express = require('express');
// import controllers
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/signup', authController.signup); // only post data on this route
router.post('/login', authController.login); // only post data on this route
router.get('/logout', authController.logout); // only post data on this route

// Middleware that applies to all the other routes after this point
router.use(authController.protect);

router.post('/forgotPassword', authController.forgotPassword); // only receives email
router.patch('/resetPassword/:token', authController.resetPassword); // receives token and new pass

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
router.patch('/updateMe', userController.updateMe);
router.delete('/deleteMe', userController.deleteMe);

// Actions restricted to admins
router.use(authController.restrictTo('admin'));

router.route('/').get(userController.getAllUsers).post(userController.createUser);
router.route('/:id').get(userController.getUser).patch(userController.updateUser).delete(userController.deleteUser);

module.exports = router;
