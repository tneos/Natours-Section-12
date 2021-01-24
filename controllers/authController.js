const crypto = require('crypto');
const { promisify } = require('util'); // promisify method from built-in util object
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

// Create token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    httpOnly: true, // cookie cannot be accessed or modified by browser
  };
  // only sent to encrypted connection https
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;
  // Attach cookie to response object and send token along with options
  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  // Send new user to client
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    role: req.body.role,
  });

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  console.log(req.body);
  const { email, password } = req.body; // Destructuring body object

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400)); // pass new error to next -- function finishes immediately
  }
  // 2) Check if user exists & password is correct
  const user = await User.findOne({ email }).select('+password'); // same field and variable name ES6 -- email: email -- '+' override schema's select: false

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401)); // 401 unauthorized
  }
  // 3) If everything ok, send token back to client
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ status: 'success' });
};

// Protected routes middleware
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Get token and check if exists
  let token;

  // const and let block scoped
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]; // Split string and get second element of array
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    // return middleware, call next one and create error
    return next(new AppError('You are not logged in. Please login to get access', 401));
  }
  // 2) Token verification -- manipulated data or token expired
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // 3) Check if user exists -- User potentially deleted but token still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('THe user that owns this token does not longer exist', 401));
  }
  // 4) Check if user changed password after token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('User recently changed password. Please login again', 401));
  }

  // Grant access to protected route
  req.user = currentUser; // data added to req object to move to next middleware
  next();
});

// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      // 2) Token verification -- manipulated data or token expired
      const decoded = await promisify(jwt.verify)(req.cookies.jwt, process.env.JWT_SECRET);
      // 3) Check if user exists -- User potentially deleted but token still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }
      // 4) Check if user changed password after token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // If everything above is true there is a logged in user
      res.locals.user = currentUser; // access to pug templates through res.locals
      return next();
    }
  } catch (err) {
    return next(); // If there is no cookie , no logged in user, next() called immediately
  }
};

// Wrapper function that returns middleware we create -- arbitrary number of arguments
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide'] -- Internal function gets access to roles parameters through closure
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403)); // 403 -- forbidden
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with that email address', 404)); // 404 not found
  }
  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false }); //save updated document
  // 3) Send it back to user's token
  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\n If you didn't forget your password please ignore this email.`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.createPasswordResetToken = undefined;
    user.createPasswordResetExpires = undefined;
    await user.save({ validateBeforeSave: false }); // save data

    return next(new AppError('There was an error sending the email. Try again later', 500)); // internal server error 500
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and user exists, set new password
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 4) Log user in , sent JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');
  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong. Try again', 401));
  }
  // 3) Update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
