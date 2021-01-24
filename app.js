const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');
//const bodyParser = require('body-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());

// GLOBAL MIDDLEWARES
// Serving static files
app.use(express.static(path.join(__dirname, 'public'))); // access to static files from folder
console.log(process.env.NODE_ENV);

// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit number of requests from same IP. -- 100 req in 1h
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour.',
});
app.use('/api', limiter); // affects all routes that start with api

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // middleware  -- modifies incoming data
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ['duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price'],
  })
);

// Data sanitization against XSS
app.use(xss()); // clean input from malicious HTML code with JS attached

// Test middleware

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log(res.locals);
  console.log(req.cookies);
  next();
});

//  ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter); // use routers as middleware
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);

// Requests that weren't caught from all other routers
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`)); // If next receives argument, there's an error
});

// Global error handling middleware -- 4 arguments, only called when there is an error
app.use(globalErrorHandler);

module.exports = app;
