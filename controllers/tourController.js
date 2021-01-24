const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// middleware to manipulate query -- prefill query object
exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

/*  We read data from database so there's no need for this part of code
const tours = JSON.parse(
  // read data from file
  fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`)
); // convert to js object


// middleware function that checks if there is a body name or price
exports.checkBody = (req, res, next) => {
  if (!req.body.name || !req.body.price) {
    return res.status(400).json({
      status: 'fail',
      message: 'Missing name or price',
    });
  }
  next();
};
*/

// all functions on export object
exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    // returns an aggregate object
    // manipulate data through stages
    {
      $match: { ratingsAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: '$difficulty',
        numTours: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
    {
      $sort: { avgPrice: 1 }, // sort the order - increment
    },
    {
      $match: { _id: { $ne: 'EASY' } }, // $ne: not equal -- exclude easy
    },
  ]);

  res.status(201).json({
    status: 'success',
    data: {
      stats,
    },
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1; // read url params and transform to a number -- 2021

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates', // deconstructs an array from input document
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`), // match between first and last day of current year
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' }, // extract month from startDates
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' }, // create an array and push the name of the field
      },
    },
    {
      $addFields: { month: '$_id' },
    },
    {
      $project: {
        // remove _id
        _id: 0,
      },
    },
    {
      $sort: { numTourStarts: -1 }, //descending -- start with highest number
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});

// '/tours-within/:distance/center/:latlng/unit/:unit'
// /tours-within/233/center/55.932381, -3.189694/unit/mi

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  // Convert distance to radians
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(new AppError('Please provide latitude and longitude in the format lat,lng', 400));
  }

  console.log(distance, lat, lng, unit);
  const tours = await Tour.find({ startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } } });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(new AppError('Please provide latitude and longitude in the format lat,lng', 400));
  }

  // Calculation on model -- Use of pipeline
  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances,
    },
  });
});
