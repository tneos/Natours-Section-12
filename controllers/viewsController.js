const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
//const User = require('../models/userModel');

exports.getLoginForm = catchAsync(async (req, res, next) => {
  // Get data
  // const user = await User.findOne().populate();
  // Build template

  // Render template
  res.status(200).render('login', {
    title: 'Log into your account',
    // user,
  });
});

exports.getOverview = catchAsync(async (req, res, next) => {
  // 1) Get tour data from collection
  const tours = await Tour.find(); // All data retrieved from database
  // 2) Build template

  // 3) Render that template using tour data from 1)
  res.status(200).render('overview', {
    title: 'All Tours',
    tours, // All data passed to template -- array of data
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) get the data, for the requested tour (including reviews and guides)
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });
  // 2) Build template

  // 3) Render template using  data from 1)
  res.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});
