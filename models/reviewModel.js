// review / rating / createdAt / ref to tour / ref to user
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      minlength: [12, 'A review must be at least 24 characters long'],
      required: [true, 'Review field cannot be empty'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId, // parent referencing
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    // schema options
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Combination of tour-user unique
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// Middleware to populate reviews data
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo', // select data we send to client
  });
  next();
});

reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // 'this' points to current model
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 }, // number of ratings
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  //console.log(stats);

  if (stats.length > 0) {
    // save statistics to current tour
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  // this points to current review
  this.constructor.calcAverageRatings(this.tour); // 'this' for current document and constructor for model that created current document
});

// findByIdAndUpdate
// findByIdAndDelete
// In a query middleware we only have access to the query
reviewSchema.pre(/^findOneAnd/, async function (next) {
  // execute query in order to have access to document
  this.r = await this.findOne(); // pass the data from pre() to post() with this.r -- retrieve review document with 'this' variable
  //console.log(this.r);
  next();
});

reviewSchema.post(/^findOneAnd/, async function () {
  // await this.findOne(); does NOT work here, query has already been executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
