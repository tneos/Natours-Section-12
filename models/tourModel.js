const mongoose = require('mongoose');
const slugify = require('slugify');
//const User = require('./userModel');

// const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    // Describe, validate data  -- schema definitions
    name: {
      type: String,
      required: [true, 'A tour must have a name'], // validator
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name cannot be more than 40 characters long.'],
      minlength: [10, 'A tour name cannot be less than 10 characters long.'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'], // Use of validator's method isAlpha
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty level'],
      enum: {
        // validator -- values allowed
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium or difficult',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: (val) => Math.round(val * 10) / 10, // 4.66666  46.6666  47  4.7
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // function has access to priceDiscount specified
          return val < this.price; // if false then validation error -- 'this' only points to current document when creating a new document --not going to work on update
        },
        message: 'Discount price ({VALUE}) should be less than regular price', // ({VALUE}) has a access to val
      },
    },
    summary: {
      type: String,
      trim: true, // Remove whitespace from beginning and end of string
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String, // name of image
      required: [true, 'A tour must have a cover image'],
    },
    images: [String], // Array of strings
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false, // createdAt not sent
    },
    startDates: [Date], // Array of dates
    secretTour: {
      type: Boolean,
      default: false,
    },
    startLocation: {
      // GeoJSON -- Embedded object
      type: {
        // Schema type options for subfields
        type: String,
        default: 'Point',
        enum: ['Point'], // possible option
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number, // day of tour people go to this location
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    // schema options
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tourSchema.index({ price: 1, ratingsAverage: -1 }); // ascending or descending order
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7; // Use of regular function -- 'this' is pointing to current document
});

// Virtual populate -- no persistence of data in database
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', // reference to reviewModel's field where tour id is stored
  localField: '_id',
});

// DOCUMENT MIDDLEWARE runs before .save() and create()
tourSchema.pre('save', function (next) {
  // callback runs before document is saved
  this.slug = slugify(this.name, { lower: true }); // define new property on current document
  next();
});

/*
// Retrieve user documents(embedding document) before new tour is saved
tourSchema.pre('save', async function (next) {
  const guidesPromises = this.guides.map(async (id) => await User.findById(id)); // array of promises
  this.guides = await Promise.all(guidesPromises); // Resolve all promises at same time -- overwrite array of id's with array of documents
  next();
});

*/
/*
tourSchema.post('save', function (doc, next) {
  console.log(doc);
  next();
});
*/

// QUERY MIDDLEWARE -- Before query is executed

tourSchema.pre(/^find/, function (next) {
  // Starts with 'find'
  this.find({ secretTour: { $ne: true } }); // not equal -- 'this' points to the query

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function (next) {
  this.populate({
    // 'this' refers to current query
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  // access to all docs that return from query
  console.log(`Query took ${Date.now() - this.start} msecs.`);

  next();
});

// AGGREGATION MIDDLEWARE
//tourSchema.pre('aggregate', function (next) {
//this.pipeline().unshift({ $match: { secretTrue: { $ne: true } } }); // remove from document outputs with secretTrue: true (add another stage to aggregation array)
//console.log(this); // current aggregation object
//next();
//});

const Tour = mongoose.model('Tour', tourSchema); // Uppercase for model names and variables

module.exports = Tour;
